import Store from 'electron-store'

type Schema = {
  encryptedMasterKey?: string
  lastAutoLockAt?: number
}

const schema: Record<keyof Schema, unknown> = {
  encryptedMasterKey: { type: 'string' },
  lastAutoLockAt: { type: 'number' },
}

export const secureStore = new Store<Schema>({
  name: 'cloudpass',
  encryptionKey: undefined,
  schema: schema as any,
})


