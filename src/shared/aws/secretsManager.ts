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
  tags?: { team?: string; department?: string }
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


