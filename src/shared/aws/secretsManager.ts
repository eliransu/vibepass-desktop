import { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, PutSecretValueCommand, DeleteSecretCommand, ListSecretsCommand, type SecretListEntry } from '@aws-sdk/client-secrets-manager'
import { fromSSO } from '@aws-sdk/credential-providers'

export type CloudPassConfig = {
  // Common
  region?: string
  cloudAccountId?: string
  team?: string
  // SSO configuration (explicit, no ~/.aws/config) - always default type
  loginUrl?: string
  roleName?: string
  // Static keys (optional session)
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

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

export async function createSecret(client: SecretsManagerClient, name: string, secretString: string): Promise<string | undefined> {
  // const parts = name.split('/')
  // const ownerCandidate = parts[4] || 'unknown'
  // const isWork = ownerCandidate === 'team' || name.includes('/team/')
  // const ownerUid = isWork ? 'team' : ownerCandidate
  const payload = { 
    Name: name, 
    SecretString: secretString,
    Tags: [
      { Key: 'App', Value: 'cloudpass' },
      // { Key: 'Scope', Value: isWork ? 'work' : 'personal' },
      // { Key: 'OwnerUid', Value: ownerUid },
    ],
  } 
  const res = await client.send(new CreateSecretCommand(payload))
  return res.ARN
}

export async function putSecret(client: SecretsManagerClient, secretId: string, secretString: string): Promise<void> {
  await client.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString }))
}

export async function deleteSecret(client: SecretsManagerClient, secretId: string, force = false): Promise<void> {
  await client.send(new DeleteSecretCommand({ SecretId: secretId, ForceDeleteWithoutRecovery: force }))
}

export type TeamSecretMeta = {
  arn?: string
  name?: string
  description?: string
  lastChangedDate?: Date
}

export async function listAppSecrets(client: SecretsManagerClient): Promise<TeamSecretMeta[]> {
  const items: TeamSecretMeta[] = []
  let nextToken: string | undefined
  do {
    const res = await client.send(new ListSecretsCommand({
      NextToken: nextToken,
      Filters: [
        { Key: 'tag-key', Values: ['App'] },
        { Key: 'tag-value', Values: ['cloudpass'] },
      ],
      MaxResults: 50,
    }))
    for (const s of (res.SecretList ?? []) as SecretListEntry[]) {
      items.push({
        arn: s.ARN,
        name: s.Name,
        description: s.Description,
        lastChangedDate: s.LastChangedDate,
      })
    }
    nextToken = res.NextToken
  } while (nextToken)
  return items
}

export async function upsertSecretByName(client: SecretsManagerClient, name: string, secretString: string): Promise<string | undefined> {
  try {
    return await createSecret(client, name, secretString)
  } catch (e: any) {
    try {
      await putSecret(client, name, secretString)
      return name
    } catch {
      throw e
    }
  }
}


