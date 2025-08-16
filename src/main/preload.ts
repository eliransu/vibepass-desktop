import { contextBridge, clipboard, ipcRenderer } from 'electron'

export type PreloadApi = {
  copyToClipboard: (text: string) => void
  keytarSet: (service: string, account: string, secret: string) => Promise<boolean>
  keytarGet: (service: string, account: string) => Promise<string | null>
  biometricCheck: () => Promise<boolean>
  biometricStore: (masterPassword: string) => Promise<boolean>
  biometricRetrieve: () => Promise<string | null>
  storeGet: <T = unknown>(key: string) => Promise<T | undefined>
  storeSet: (key: string, value: unknown) => Promise<boolean>
  awsGetProfiles: () => Promise<Record<string, string>>
  awsSsoLogin: (profile: string) => Promise<{ ok: boolean; error?: string }>
  awsGetAccount: (profile?: string) => Promise<string | null>
  awsGetDefaultRegion: (profile?: string) => Promise<string | null>
  teamList: (region: string, ids: string[]) => Promise<Record<string, string | null>>
  teamListWithProfile: (region: string, ids: string[], profile?: string) => Promise<Record<string, string | null>>
  teamCreate: (region: string, name: string, secretString: string, profile?: string) => Promise<string | undefined>
  teamUpdate: (region: string, id: string, secretString: string) => Promise<boolean>
  teamDelete: (region: string, id: string, force: boolean) => Promise<boolean>
  teamListApp: (region: string, profile?: string) => Promise<Array<{ arn?: string; name?: string; description?: string; lastChangedDate?: string }>>
  teamGetSecretValue: (region: string, secretId: string, profile?: string) => Promise<string | null>
  // Consolidated vault secret helpers
  vaultRead: (region: string, name: string, profile?: string) => Promise<string | null>
  vaultWrite: (region: string, name: string, secretString: string, profile?: string) => Promise<boolean>
  onLock: (handler: () => void) => void
}

const api: PreloadApi = {
  copyToClipboard(text: string): void {
    clipboard.writeText(text, 'clipboard')
  },
  async keytarSet(service: string, account: string, secret: string): Promise<boolean> {
    return ipcRenderer.invoke('secure:keytar-set', service, account, secret)
  },
  async keytarGet(service: string, account: string): Promise<string | null> {
    return ipcRenderer.invoke('secure:keytar-get', service, account)
  },
  async biometricCheck(): Promise<boolean> {
    return ipcRenderer.invoke('secure:biometric-check')
  },
  async biometricStore(masterPassword: string): Promise<boolean> {
    return ipcRenderer.invoke('secure:biometric-store', masterPassword)
  },
  async biometricRetrieve(): Promise<string | null> {
    return ipcRenderer.invoke('secure:biometric-retrieve')
  },
  async storeGet<T = unknown>(key: string): Promise<T | undefined> {
    return ipcRenderer.invoke('store:get', key)
  },
  async storeSet(key: string, value: unknown): Promise<boolean> {
    return ipcRenderer.invoke('store:set', key, value)
  },
  async awsGetProfiles(): Promise<Record<string, string>> {
    return ipcRenderer.invoke('aws:get-profiles')
  },
  async awsSsoLogin(profile: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('aws:sso-login', profile)
  },
  async awsGetAccount(profile?: string): Promise<string | null> {
    return ipcRenderer.invoke('aws:get-account', profile)
  },
  async awsGetDefaultRegion(profile?: string): Promise<string | null> {
    return ipcRenderer.invoke('aws:get-default-region', profile)
  },
  async teamList(region: string, ids: string[]): Promise<Record<string, string | null>> {
    return ipcRenderer.invoke('team:list', region, ids)
  },
  async teamListWithProfile(region: string, ids: string[], profile?: string): Promise<Record<string, string | null>> {
    return ipcRenderer.invoke('team:list', region, ids, profile)
  },
  async teamCreate(region: string, name: string, secretString: string, profile?: string): Promise<string | undefined> {
    return ipcRenderer.invoke('team:create', region, name, secretString, profile)
  },
  async teamUpdate(region: string, id: string, secretString: string): Promise<boolean> {
    return ipcRenderer.invoke('team:update', region, id, secretString)
  },
  async teamDelete(region: string, id: string, force: boolean): Promise<boolean> {
    return ipcRenderer.invoke('team:delete', region, id, force)
  },
  async teamListApp(region: string, profile?: string): Promise<Array<{ arn?: string; name?: string; description?: string; lastChangedDate?: string }>> {
    return ipcRenderer.invoke('team:list-app', region, profile)
  },
  async teamGetSecretValue(region: string, secretId: string, profile?: string): Promise<string | null> {
    return ipcRenderer.invoke('team:get-secret-value', region, secretId, profile)
  },
  async vaultRead(region: string, name: string, profile?: string): Promise<string | null> {
    return ipcRenderer.invoke('vault:read', region, name, profile)
  },
  async vaultWrite(region: string, name: string, secretString: string, profile?: string): Promise<boolean> {
    return ipcRenderer.invoke('vault:write', region, name, secretString, profile)
  },
  onLock(handler: () => void): void {
    ipcRenderer.removeAllListeners('master:lock')
    ipcRenderer.on('master:lock', () => {
      try { handler() } catch {}
    })
  },
}

contextBridge.exposeInMainWorld('vibepass', api)

declare global {
  interface Window {
    vibepass: PreloadApi
  }
}


