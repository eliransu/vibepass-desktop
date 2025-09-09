import { contextBridge, ipcRenderer, desktopCapturer, screen } from 'electron'

export type PreloadApi = {
  copyToClipboard: (text: string) => void
  getAwsUserIdentity: () => Promise<string>
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
  teamList: (region: string, ids: string[]) => Promise<Record<string, string | null>>
  teamListWithProfile: (region: string, ids: string[], profile?: string) => Promise<Record<string, string | null>>
  teamCreate: (region: string, name: string, secretString: string, profile?: string) => Promise<string | undefined>
  teamUpdate: (region: string, id: string, secretString: string) => Promise<boolean>
  teamDelete: (region: string, id: string, force: boolean) => Promise<boolean>
  teamListApp: (region: string, profile?: string) => Promise<Array<{ arn?: string; name?: string; description?: string; lastChangedDate?: string }>>
  teamGetSecretValue: (region: string, secretId: string, profile?: string) => Promise<string | null>
  // Consolidated vault secret helpers
  vaultRead: (region: string, name: string, profile?: string) => Promise<{ success: true; data: string | null } | { success: false; error: string; message: string }>
  vaultWrite: (region: string, name: string, secretString: string, profile?: string) => Promise<boolean>
  // QR / screen capture helpers
  captureScreen: () => Promise<string | null>
  // Capture composited active frame using getUserMedia
  captureActiveFrame: () => Promise<string | null>
  // OS picker capture via getDisplayMedia (user selects screen/window)
  captureViaPicker: () => Promise<string | null>
  // Native crop (macOS) - returns data URL
  cropScreen: () => Promise<string | null>
  // Overlay cropper
  openCropOverlay: () => Promise<void>
  closeCropOverlay: () => Promise<void>
  onCropResult: (handler: (text: string) => void) => void
  onLock: (handler: () => void) => void
}

const api: PreloadApi = {
  copyToClipboard(text: string): void {
    void ipcRenderer.invoke('clipboard:write', text)
  },
  async getAwsUserIdentity(): Promise<string> {
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
  async vaultRead(region: string, name: string, profile?: string): Promise<{ success: true; data: string | null } | { success: false; error: string; message: string }> {
    return ipcRenderer.invoke('vault:read', region, name, profile)
  },
  async vaultWrite(region: string, name: string, secretString: string, profile?: string): Promise<boolean> {
    return ipcRenderer.invoke('vault:write', region, name, secretString, profile)
  },
  async captureScreen(): Promise<string | null> {
    // Try renderer-side capture (preferred)
    try {
      const primary = screen.getPrimaryDisplay()
      const scale = primary.scaleFactor || 1
      // High-res thumbnail to improve QR readability
      const size = { width: Math.max(800, Math.floor(primary.size.width * scale)), height: Math.max(600, Math.floor(primary.size.height * scale)) }
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size as any })
      if (!sources || sources.length === 0) return null
      // Match by display_id first
      const matchById = sources.find(s => s.display_id === String(primary.id))
      const source = matchById || sources.find(s => /primary|main/i.test(s.name)) || sources[0]
      const img = source.thumbnail
      const dataUrl = img?.toDataURL() || null
      if (dataUrl) return dataUrl
    } catch {}
    // Fallback to main IPC handler
    try { return await ipcRenderer.invoke('screen:capture') } catch { return null }
  },
  async captureActiveFrame(): Promise<string | null> {
    try {
      const primary = screen.getPrimaryDisplay()
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } as any })
      const source = sources.find(s => s.display_id === String(primary.id)) || sources[0]
      if (!source) return null
      const constraints: any = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            maxFrameRate: 1,
          },
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings?.() || {}
      const width = (settings.width as number) || primary.size.width * (primary.scaleFactor || 1)
      const height = (settings.height as number) || primary.size.height * (primary.scaleFactor || 1)
      const video = document.createElement('video')
      video.srcObject = stream as any
      await new Promise((res) => { video.onloadedmetadata = () => { try { video.play().then(res).catch(res) } catch { res(undefined as any) } } })
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || width
      canvas.height = video.videoHeight || height
      const ctx = canvas.getContext('2d')
      if (!ctx) { try { stream.getTracks().forEach(t => t.stop()) } catch {}; return null }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      try { stream.getTracks().forEach(t => t.stop()) } catch {}
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  },
  async captureViaPicker(): Promise<string | null> {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings?.() || {}
      const width = (settings.width as number) || 1920
      const height = (settings.height as number) || 1080
      const video = document.createElement('video')
      video.srcObject = stream as any
      await new Promise((res) => { video.onloadedmetadata = () => { try { video.play().then(res).catch(res) } catch { res(undefined as any) } } })
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || width
      canvas.height = video.videoHeight || height
      const ctx = canvas.getContext('2d')
      if (!ctx) { try { stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()) } catch {}; return null }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      try { stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()) } catch {}
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  },
  async cropScreen(): Promise<string | null> {
    return ipcRenderer.invoke('screen:crop')
  },
  async openCropOverlay(): Promise<void> {
    await ipcRenderer.invoke('overlay:open')
  },
  async closeCropOverlay(): Promise<void> {
    await ipcRenderer.invoke('overlay:close')
  },
  onCropResult(handler: (text: string) => void): void {
    ipcRenderer.removeAllListeners('overlay:result')
    ipcRenderer.on('overlay:result', (_evt, text: string) => {
      try { handler(text) } catch {}
    })
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


