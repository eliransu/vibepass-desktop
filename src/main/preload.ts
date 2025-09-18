import { contextBridge, ipcRenderer, desktopCapturer, screen } from 'electron'

export type PreloadApi = {
  copyToClipboard: (text: string) => void
  getAwsUserIdentity: () => Promise<{ ok: true; userId: string } | { ok: false; error: string; code?: string }>
  keytarSet: (service: string, account: string, secret: string) => Promise<boolean>
  keytarGet: (service: string, account: string) => Promise<string | null>
  biometricCheck: () => Promise<boolean>
  biometricStore: (masterPassword: string) => Promise<boolean>
  biometricRetrieve: () => Promise<string | null>
  storeGet: <T = unknown>(key: string) => Promise<T | undefined>
  storeSet: (key: string, value: unknown) => Promise<boolean>
  // Explicit config management
  configGet: () => Promise<any | null>
  configSet: (cfg: any | null) => Promise<boolean>
  fileOpenJson: () => Promise<{ name: string; content: string } | null>
  openExternal: (url: string) => Promise<boolean>
  awsSsoLogin: () => Promise<{ ok: boolean; error?: string }>
  teamGetSecretValue: (region: string, secretId: string, profile?: string) => Promise<string | null>
  // Consolidated vault secret helpers
  vaultRead: (region: string, name: string, profile?: string) => Promise<{ success: true; data: string | null } | { success: false; error: string; message: string }>
  vaultWrite: (region: string, name: string, secretString: string, profile?: string) => Promise<boolean>
  // QR / screen capture helpers
  captureScreen: () => Promise<string | null>
  // Native crop (macOS) - returns data URL
  cropScreen: () => Promise<string | null>
  onLock: (handler: () => void) => void
}

const api: PreloadApi = {
  copyToClipboard(text: string): void {
    void ipcRenderer.invoke('clipboard:write', text)
  },
  async getAwsUserIdentity(): Promise<{ ok: true; userId: string } | { ok: false; error: string; code?: string }> {
    return ipcRenderer.invoke('aws:get-user-identity')
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
  async configGet(): Promise<any | null> {
    return ipcRenderer.invoke('config:get')
  },
  async configSet(cfg: any | null): Promise<boolean> {
    return ipcRenderer.invoke('config:set', cfg)
  },
  async fileOpenJson(): Promise<{ name: string; content: string } | null> {
    return ipcRenderer.invoke('file:open-json')
  },
  async openExternal(url: string): Promise<boolean> {
    return ipcRenderer.invoke('shell:open-external', url)
  },
  async awsSsoLogin(): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('aws:sso-login')
  },
  async teamGetSecretValue(region: string, secretId: string, profile?: string): Promise<string | null> {
    return ipcRenderer.invoke('team:get-secret-value', region, secretId, profile)
  },
  async vaultRead(region: string, name: string, profile?: string): Promise<{ success: true; data: string | null } | { success: false; error: string; message: string }> {
    return ipcRenderer.invoke('vault:read', region, name, profile)
  },
  async vaultWrite(region: string, name: string, secretString: string, profile?: string): Promise<boolean> {
    return ipcRenderer.invoke('vault:write', region, name, secretString, profile)
  },
  async captureScreen(): Promise<string | null> {
    try {
      const primary = screen.getPrimaryDisplay()
      const scale = primary.scaleFactor || 1
      const size = { width: Math.max(800, Math.floor(primary.size.width * scale)), height: Math.max(600, Math.floor(primary.size.height * scale)) }
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size as any })
      if (!sources || sources.length === 0) return null
      const matchById = sources.find((s: any) => s.display_id === String(primary.id))
      const source = matchById || sources.find((s: any) => /primary|main/i.test(s.name)) || sources[0]
      const img = source.thumbnail
      const dataUrl = img?.toDataURL() || null
      return dataUrl
    } catch {
      return null
    }
  },
  async cropScreen(): Promise<string | null> {
    return ipcRenderer.invoke('screen:crop')
  },
  onLock(handler: () => void): void {
    ipcRenderer.removeAllListeners('master:lock')
    ipcRenderer.on('master:lock', () => {
      try { handler() } catch {}
    })
  },
}

contextBridge.exposeInMainWorld('cloudpass', api)

declare global {
  interface Window {
    cloudpass: PreloadApi
  }
}


