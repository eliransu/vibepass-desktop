import { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, PutSecretValueCommand, DeleteSecretCommand, ListSecretsCommand, type SecretListEntry } from '@aws-sdk/client-secrets-manager'
import { fromSSO } from '@aws-sdk/credential-providers'

export function createSecretsClient(region: string): SecretsManagerClient {
  if (!process.env.AWS_SDK_LOAD_CONFIG) {
    process.env.AWS_SDK_LOAD_CONFIG = '1'
  }
  if (!process.env.HOME || process.env.HOME.trim().length === 0) {
  }
  return new SecretsManagerClient({ region, credentials: fromSSO({}) })
}

export async function getSecret(client: SecretsManagerClient, secretId: string): Promise<string | undefined> {
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }))
  return res.SecretString
}

export async function createSecret(client: SecretsManagerClient, name: string, secretString: string): Promise<string | undefined> {
  const res = await client.send(new CreateSecretCommand({ 
    Name: name, 
    SecretString: secretString,
    Tags: [
      { Key: 'App', Value: 'VibePass' },
    ],
  }))
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
        { Key: 'tag-value', Values: ['VibePass'] },
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


