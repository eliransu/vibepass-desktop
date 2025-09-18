import { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, PutSecretValueCommand, DeleteSecretCommand } from '@aws-sdk/client-secrets-manager'
import { fromSSO } from '@aws-sdk/credential-providers'

export type CloudPassConfig = {
  // Common
  region?: string
  cloudAccountId?: string
  team?: string
  department?: string
  // SSO configuration (explicit, no ~/.aws/config) - always default type
  loginUrl?: string
  roleName?: string
  // Static keys (optional session)
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

export type CreateSecretTags = { department?: string; scope?: 'personal' | 'work'; owner?: string }

export function createSecretsClient(region: string, auth?: CloudPassConfig | null): SecretsManagerClient {
  // Prefer explicit credentials/config and avoid any OS-based providers
  if (auth && auth.accessKeyId && auth.secretAccessKey) {
    return new SecretsManagerClient({
      region,
      credentials: {
        accessKeyId: String(auth.accessKeyId),
        secretAccessKey: String(auth.secretAccessKey),
        sessionToken: auth.sessionToken ? String(auth.sessionToken) : undefined,
      },
    })
  }
  if (auth && auth.loginUrl && auth.cloudAccountId && auth.roleName) {
    return new SecretsManagerClient({
      region,
      credentials: fromSSO({
        startUrl: String(auth.loginUrl),
        region: String(region), // Use the region parameter since ssoRegion was merged with region
        accountId: String(auth.cloudAccountId),
        roleName: String(auth.roleName),
      } as any),
    })
  }
  // As a last resort, construct a client without credentials (will fail fast)
  return new SecretsManagerClient({ region })
}

export async function getSecret(client: SecretsManagerClient, secretId: string): Promise<string | undefined> {
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }))
  return res.SecretString
}

export async function createSecret(
  client: SecretsManagerClient,
  name: string,
  secretString: string,
  tags?: CreateSecretTags
): Promise<string | undefined> {
  const payload = { 
    Name: name, 
    SecretString: secretString,
    Tags: [
      { Key: 'App', Value: 'cloudpass' },
    ],
  } 
  if (tags?.department) {
    ;(payload.Tags as Array<{ Key: string; Value: string }>).push({ Key: 'Department', Value: String(tags.department) })
  }
  if (tags?.scope) {
    ;(payload.Tags as Array<{ Key: string; Value: string }>).push({ Key: 'Scope', Value: String(tags.scope) })
  }
  if (tags?.owner) {
    ;(payload.Tags as Array<{ Key: string; Value: string }>).push({ Key: 'Owner', Value: String(tags.owner) })
  }
  // Intentionally avoid logging secret payloads in production builds
  const res = await client.send(new CreateSecretCommand(payload))
  return res.ARN
}

export async function putSecret(client: SecretsManagerClient, secretId: string, secretString: string): Promise<void> {
  await client.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString }))
}

export async function deleteSecret(client: SecretsManagerClient, secretId: string, force = false): Promise<void> {
  await client.send(new DeleteSecretCommand({ SecretId: secretId, ForceDeleteWithoutRecovery: force }))
}

// Removed listAppSecrets and upsertSecretByName (not used in current flows)


// Concurrency-safe JSON upsert for department/team secrets
// Strategy: read latest -> deep-merge with incoming object -> put. Retry a few times on races.
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function deepMerge(base: JsonValue, update: JsonValue): JsonValue {
  if (isPlainObject(base) && isPlainObject(update)) {
    const result: Record<string, JsonValue> = { ...(base as Record<string, JsonValue>) }
    for (const key of Object.keys(update as Record<string, JsonValue>)) {
      const bv = (base as Record<string, JsonValue>)[key]
      const uv = (update as Record<string, JsonValue>)[key]
      result[key] = deepMerge(bv as JsonValue, uv as JsonValue)
    }
    return result
  }
  // Arrays and primitives: prefer update by replacement
  return update
}

function tryParseJson(input: string): JsonValue | undefined {
  try {
    return JSON.parse(input) as JsonValue
  } catch {
    return undefined
  }
}

export async function upsertJsonMergedSecret(
  client: SecretsManagerClient,
  name: string,
  incomingSecretString: string,
  tags?: CreateSecretTags
): Promise<void> {
  const maxAttempts = 3
  let attempt = 0

  while (attempt < maxAttempts) {
    attempt++
    // Read current (if any)
    let currentString: string | undefined
    try {
      currentString = await getSecret(client, name)
    } catch (e: any) {
      const code = e?.name || e?.code || ''
      const notFound = code === 'ResourceNotFoundException'
      if (!notFound) throw e
      currentString = undefined
    }

    if (!currentString) {
      // Try create first for proper tagging
      try {
        await createSecret(client, name, incomingSecretString, tags)
        return
      } catch (e: any) {
        const code = e?.name || e?.code || ''
        const alreadyExists = code === 'ResourceExistsException'
        if (!alreadyExists) throw e
        // If it now exists, fall through to merge path
      }
    }

    // Merge JSON safely; if parsing fails, fallback to incoming as authoritative
    const parsedCurrent = currentString ? tryParseJson(currentString) : undefined
    const parsedIncoming = tryParseJson(incomingSecretString)

    let mergedString: string
    if (parsedIncoming && (parsedCurrent || currentString)) {
      const base: JsonValue = parsedCurrent ?? tryParseJson('{}')!
      const merged = deepMerge(base, parsedIncoming)
      mergedString = JSON.stringify(merged)
    } else {
      // Non-JSON payloads: replace to avoid corrupting encrypted/personal secrets
      mergedString = incomingSecretString
    }

    // If nothing changed, exit early
    if (mergedString === (currentString ?? '')) return

    try {
      await putSecret(client, name, mergedString)
      return
    } catch (e: any) {
      // On rare races (e.g., secret rotated/deleted concurrently), retry loop
      if (attempt >= maxAttempts) throw e
      await new Promise((r) => setTimeout(r, 50 * attempt))
    }
  }
}


