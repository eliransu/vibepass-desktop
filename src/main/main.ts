import { app, BrowserWindow, shell, Menu, ipcMain, systemPreferences, clipboard as mainClipboard, dialog, desktopCapturer, screen } from 'electron'
import keytar from 'keytar'
import Store from 'electron-store'
import { createSecretsClient, getSecret, createSecret, putSecret, deleteSecret, listAppSecrets, type CloudPassConfig } from '../shared/aws/secretsManager'
import path from 'node:path'
import http from 'node:http'
import { URL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import { autoUpdater } from 'electron-updater'
import { execFile, execFileSync } from 'node:child_process'
import { SSOOIDCClient, RegisterClientCommand, StartDeviceAuthorizationCommand, CreateTokenCommand } from '@aws-sdk/client-sso-oidc'
import { SSOClient, GetRoleCredentialsCommand } from '@aws-sdk/client-sso'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
const store = new Store<{ [key: string]: unknown }>({ name: 'cloudpass' })
// Removed blur-based auto-lock; we only lock on hide now

// All AWS/SSO OS-based helpers removed. We strictly use explicit JSON config.

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
    },
  })

  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    mainWindow.loadURL('http://localhost:3000')
  } else {
    // Serve renderer over http://127.0.0.1 to satisfy OAuth requirements (no file://)
    // Use a fixed port so the origin stays stable across restarts and auth/session persists
    const FIXED_PORT = Number(process.env.CLOUDPASS_PORT || process.env.ENESECRETS_PORT || process.env.VIBEPASS_PORT || 17896)
    const rendererDir = path.join(__dirname, '../renderer')
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
        let pathname = decodeURIComponent(reqUrl.pathname)
        if (pathname === '/') pathname = '/index.html'
        let filePath = path.join(rendererDir, pathname)
        // Prevent path traversal
        if (!filePath.startsWith(rendererDir)) {
          filePath = path.join(rendererDir, 'index.html')
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            // Fallback to SPA index.html
            fs.readFile(path.join(rendererDir, 'index.html'), (err2, data2) => {
              if (err2) {
                res.writeHead(404)
                res.end('Not Found')
              } else {
                res.setHeader('Content-Type', 'text/html; charset=UTF-8')
                res.writeHead(200)
                res.end(data2)
              }
            })
            return
          }
          // Basic content-type mapping
          const ext = path.extname(filePath).toLowerCase()
          const type = ext === '.html' ? 'text/html; charset=UTF-8'
            : ext === '.js' ? 'application/javascript'
            : ext === '.css' ? 'text/css'
            : ext === '.json' ? 'application/json'
            : ext === '.svg' ? 'image/svg+xml'
            : ext === '.png' ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.map' ? 'application/json'
            : 'application/octet-stream'
          res.setHeader('Content-Type', type)
          res.writeHead(200)
          res.end(data)
        })
      } catch {
        res.writeHead(500)
        res.end('Server error')
      }
    })
    // Prefer a fixed port; if taken, attempt next few ports deterministically
    const tryListen = (port: number, attemptsLeft: number): void => {
      server.once('error', (err: any) => {
        if ((err?.code === 'EADDRINUSE' || err?.code === 'EACCES') && attemptsLeft > 0) {
          tryListen(port + 1, attemptsLeft - 1)
        } else {
          // Fallback to file protocol if server failed
          mainWindow?.loadFile(path.join(rendererDir, 'index.html'))
        }
      })
      server.listen(port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${port}`
        mainWindow?.loadURL(url)
      })
    }
    tryListen(FIXED_PORT, 5)
  }

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Auto-lock disabled per user request

  // Security: open all external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { /* no allowlist needed */ } catch {}
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createMainWindow()
  Menu.setApplicationMenu(null)
  if (!app.isPackaged) return
  if (process.env.CLOUDPASS_AUTOUPDATE === '1' || process.env.ENESECRETS_AUTOUPDATE === '1' || process.env.VIBEPASS_AUTOUPDATE === '1') {
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

// Secure IPC for keytar
ipcMain.handle('secure:keytar-set', async (_evt, service: string, account: string, secret: string) => {
  await keytar.setPassword(service, account, secret)
  return true
})

ipcMain.handle('secure:keytar-get', async (_evt, service: string, account: string) => {
  const val = await keytar.getPassword(service, account)
  return val ?? null
})

// Biometric authentication
ipcMain.handle('secure:biometric-check', async () => {
  try {
    const current = await keytar.getPassword('cloudpass-Biometric', 'master-password')
    const legacy = await keytar.getPassword('VibePass-Biometric', 'master-password')
    const hasSecret = Boolean(current || legacy)
    if (process.platform === 'darwin') {
      const canPrompt = typeof systemPreferences.canPromptTouchID === 'function' ? systemPreferences.canPromptTouchID() : false
      return hasSecret && canPrompt
    }
    // Other platforms not supported for biometric prompt here
    return false
  } catch {
    return false
  }
})

ipcMain.handle('secure:biometric-store', async (_evt, masterPassword: string) => {
  try {
    // Store master password with biometric protection
    await keytar.setPassword('cloudpass-Biometric', 'master-password', masterPassword)
    // Backward-compatibility: also write legacy key name
    try { await keytar.setPassword('VibePass-Biometric', 'master-password', masterPassword) } catch {}
    return true
  } catch {
    return false
  }
})

ipcMain.handle('secure:biometric-retrieve', async () => {
  try {
    if (process.platform === 'darwin') {
      // This will show the Touch ID prompt. It throws if cancelled or unavailable.
      if (typeof systemPreferences.promptTouchID === 'function') {
        await systemPreferences.promptTouchID('Unlock CloudPass')
      }
      let password = await keytar.getPassword('cloudpass-Biometric', 'master-password')
      if (!password) {
        password = await keytar.getPassword('VibePass-Biometric', 'master-password')
      }
      return password ?? null
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('store:get', async (_evt, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', async (_evt, key: string, value: unknown) => {
  store.set(key, value as any)
  return true
})

// Config storage
ipcMain.handle('config:get', async () => {
  const cfg = store.get('cloudpassConfig') as CloudPassConfig | undefined
  return cfg ?? null
})

ipcMain.handle('config:set', async (_evt, cfg: CloudPassConfig | null) => {
  if (cfg) {
    store.set('cloudpassConfig', cfg as any)
  } else {
    store.delete('cloudpassConfig')
  }
  return true
})

// AWS Secrets Manager via IPC - renderer sends already encrypted strings
ipcMain.handle('team:list', async (_evt, region: string, ids: string[], _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  const results: Record<string, string | null> = {}
  for (const id of ids) {
    try {
      results[id] = (await getSecret(client, id)) ?? null
    } catch {
      results[id] = null
    }
  }
  return results
})

ipcMain.handle('team:create', async (_evt, region: string, name: string, secretString: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  return createSecret(client, name, secretString)
})

ipcMain.handle('team:update', async (_evt, region: string, id: string, secretString: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  await putSecret(client, id, secretString)
  return true
})

ipcMain.handle('team:delete', async (_evt, region: string, id: string, force: boolean, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  await deleteSecret(client, id, force)
  return true
})

// List cloudpass-tagged secrets
ipcMain.handle('team:list-app', async (_evt, region: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  return listAppSecrets(client)
})

// Get a secret value by ARN/id
ipcMain.handle('team:get-secret-value', async (_evt, region: string, secretId: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  return (await getSecret(client, secretId)) ?? null
})

// Consolidated vault secret read/write by name
ipcMain.handle('vault:read', async (_evt, region: string, name: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  try {
    const result = await getSecret(client, name)
    return { success: true, data: result ?? null }
  } catch (e: any) {
    console.error('vault:read error:', name, 'Error details:', JSON.stringify({
      name: e.name,
      __type: e.__type,
      code: e.code,
      message: e.message
    }, null, 2))
    
    // Check multiple possible error type indicators
    const isAccessDenied = e.__type === 'AccessDeniedException' || 
                          e.name === 'AccessDeniedException' || 
                          e.code === 'AccessDeniedException' ||
                          (e.message && e.message.includes('AccessDenied'))
    
    if (isAccessDenied) {
      return { success: false, error: 'AccessDeniedException', message: e.message || 'Access denied to vault secret' }
    }
    return { success: true, data: null }
  }
})

ipcMain.handle('vault:write', async (_evt, region: string, name: string, secretString: string, _profile?: string) => {
  const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
  const sess = (store.get('cloudpassSessionCreds') as any) || null
  const now = Date.now()
  const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
  const effectiveAuth = hasSess ? ({ type: 'keys', accessKeyId: sess.accessKeyId, secretAccessKey: sess.secretAccessKey, sessionToken: sess.sessionToken } as any) : cfg
  const client = createSecretsClient(region, effectiveAuth)
  // Prefer create; if already exists, fall back to update
  try {
    await createSecret(client, name, secretString)
  } catch (e: any) {
    const code = e?.name || e?.code || ''
    const msg = e?.message || ''
    const alreadyExists = code === 'ResourceExistsException' || /already ?exists|exists/i.test(msg)
    if (!alreadyExists) throw e
    await putSecret(client, name, secretString)
  }
  return true
})
// All AWS profile/region OS-based handlers removed

// File open helper for JSON config
ipcMain.handle('file:open-json', async () => {
  try {
    const res = await dialog.showOpenDialog({
      title: 'Open CloudPass config',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null
    const filePath = res.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { name: path.basename(filePath), content }
  } catch {
    return null
  }
})

// Open external URL in default browser
ipcMain.handle('shell:open-external', async (_evt, url: string) => {
  try { shell.openExternal(String(url || '')); return true } catch { return false }
})

// Explicit SSO device authorization login using JSON config
ipcMain.handle('aws:sso-login', async () => {
  try {
    const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
    if (!cfg?.loginUrl || !cfg?.region || !cfg?.cloudAccountId || !cfg?.roleName) throw new Error('Missing SSO config')
    const oidc = new SSOOIDCClient({ region: cfg.region })
    const reg = await oidc.send(new RegisterClientCommand({ clientName: 'cloudpass-app', clientType: 'public' }))
    const started = await oidc.send(new StartDeviceAuthorizationCommand({ clientId: reg.clientId!, clientSecret: reg.clientSecret!, startUrl: cfg.loginUrl }))
    if (started.verificationUriComplete) {
      try { await shell.openExternal(started.verificationUriComplete) } catch {}
    }
    const intervalMs = (started.interval ? Number(started.interval) : 5) * 1000
    let accessToken: string | undefined
    const deadline = Date.now() + 10 * 60 * 1000
    while (!accessToken) {
      if (Date.now() > deadline) throw new Error('SSO login timed out')
      await new Promise((r) => setTimeout(r, intervalMs))
      try {
        const token = await oidc.send(new CreateTokenCommand({
          clientId: reg.clientId!,
          clientSecret: reg.clientSecret!,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode: started.deviceCode!,
        }))
        if (token && token.accessToken) accessToken = token.accessToken
      } catch (e: any) {
        const code = e?.name || e?.Code || ''
        if (code === 'AuthorizationPendingException' || code === 'SlowDownException') {
          continue
        }
        throw e
      }
    }
    if (!accessToken) throw new Error('No access token')
    const sso = new SSOClient({ region: cfg.region })
    const creds = await sso.send(new GetRoleCredentialsCommand({ accountId: cfg.cloudAccountId!, roleName: cfg.roleName!, accessToken }))
    const c = creds.roleCredentials
    if (!c?.accessKeyId || !c?.secretAccessKey || !c?.sessionToken || !c?.expiration) throw new Error('Invalid role credentials')
    store.set('cloudpassSessionCreds', {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      sessionToken: c.sessionToken,
      expiration: Number(c.expiration),
      accountId: cfg.cloudAccountId,
      roleName: cfg.roleName,
      obtainedAt: Date.now(),
    } as any)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SSO failed' }
  }
})


// AWS STS caller identity for per-user identity in SSM namespacing
ipcMain.handle('aws:get-user-identity', async () => {
  try {
    const cfg = (store.get('cloudpassConfig') as CloudPassConfig | undefined) ?? null
    const sess = (store.get('cloudpassSessionCreds') as any) || null
    const now = Date.now()
    const hasSess = sess && typeof sess.expiration === 'number' && now < Number(sess.expiration)
    
    if (!hasSess && !cfg) {
      throw new Error('No AWS configuration or session available')
    }
    
    // If SSO config is present but no active session, instruct renderer to log in
    if (!hasSess && cfg && cfg.loginUrl && cfg.cloudAccountId && cfg.roleName) {
      return { ok: false, error: 'SSO session required', code: 'SessionRequired' }
    }

    const effectiveAuth = hasSess ? ({
      type: 'keys',
      accessKeyId: sess.accessKeyId,
      secretAccessKey: sess.secretAccessKey,
      sessionToken: sess.sessionToken
    } as any) : cfg
    
    // Use the same region as configured, fallback to us-east-1 for STS
    const region = cfg?.region || 'us-east-1'
    
    let stsClient: STSClient
    if (effectiveAuth && effectiveAuth.accessKeyId && effectiveAuth.secretAccessKey) {
      stsClient = new STSClient({
        region,
        credentials: {
          accessKeyId: String(effectiveAuth.accessKeyId),
          secretAccessKey: String(effectiveAuth.secretAccessKey),
          sessionToken: effectiveAuth.sessionToken ? String(effectiveAuth.sessionToken) : undefined,
        },
      })
    } else {
      throw new Error('Invalid AWS configuration')
    }
    
    const result = await stsClient.send(new GetCallerIdentityCommand({}))
    const userId = result.UserId
    
    if (!userId) {
      throw new Error('No UserId in STS response')
    }
    
    // Split on ":" and take the second part (index 1)
    const userIdParts = userId.split(':')
    const extractedUserId = userIdParts.length > 1 ? userIdParts[1] : userId
    
    return { ok: true, userId: extractedUserId }
  } catch (e: any) {
    const code = e?.name || e?.code || 'UnknownError'
    const message = e?.message || 'Unknown error'
    console.error('❌ Failed to get AWS user identity:', message)
    return { ok: false, error: `Unable to determine user identity from AWS STS: ${message}`, code }
  }
})

// Clipboard write handler to avoid using clipboard in preload under sandbox
ipcMain.handle('clipboard:write', async (_evt, text: string) => {
  try {
    mainClipboard.writeText(String(text ?? ''), 'clipboard')
    return true
  } catch {
    return false
  }
})

// Screen capture -> returns data URL of primary display image (user picks source if multiple)
ipcMain.handle('screen:capture', async () => {
  try {
    const primary = screen.getPrimaryDisplay()
    const scale = primary.scaleFactor || 1
    const size = { width: Math.max(800, Math.floor(primary.size.width * scale)), height: Math.max(600, Math.floor(primary.size.height * scale)) }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size as any })
    if (!sources || sources.length === 0) return null
    // Prefer primary display if labeled as such; else first
    const source = sources.find(s => /primary|main/i.test(s.name)) || sources[0]
    const img = source.thumbnail
    const dataUrl = img?.toDataURL() || null
    return dataUrl
  } catch {
    return null
  }
})

// macOS native interactive crop using screencapture
ipcMain.handle('screen:crop', async () => {
  try {
    if (process.platform !== 'darwin') return null
    const tmpPath = path.join(os.tmpdir(), `cloudpass-crop-${Date.now()}.png`)
    // Resolve screencapture binary
    let bin = '/usr/sbin/screencapture'
    try { const which = execFileSync('/usr/bin/which', ['screencapture'], { encoding: 'utf8' }).trim(); if (which) bin = which } catch {}
    await new Promise<void>((resolve, reject) => {
      const child = execFile(bin, ['-i', '-x', '-t', 'png', tmpPath], (error) => {
        if (error) return reject(error)
        resolve()
      })
      child.on('error', reject)
    })
    if (!fs.existsSync(tmpPath)) return null
    const buf = fs.readFileSync(tmpPath)
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64')
    try { fs.unlinkSync(tmpPath) } catch {}
    return dataUrl
  } catch {
    return null
  }
})

// Simple transparent overlay to let user draw a rectangle and extract image crop -> QR decode in renderer
ipcMain.handle('overlay:open', async () => {
  try {
    if (overlayWindow) { overlayWindow.focus(); return }
    const { width, height } = screen.getPrimaryDisplay().bounds
    overlayWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      fullscreen: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      movable: false,
      resizable: false,
      focusable: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
    })
    const overlayHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      html,body{margin:0;padding:0;background:rgba(0,0,0,0.25);height:100%;cursor:crosshair}
      canvas{display:block;width:100vw;height:100vh}
      .toolbar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px}
      button{background:#111827cc;color:#fff;border:1px solid #374151;padding:8px 12px;border-radius:8px}
    </style></head><body>
      <div class="toolbar">
        <button id="cancel">Cancel</button>
        <button id="scan">Scan</button>
      </div>
      <canvas id="c"></canvas>
      <script>
        const { desktopCapturer, screen, ipcRenderer } = require('electron')
        const c = document.getElementById('c'); const ctx = c.getContext('2d')
        function fit(){ c.width = window.innerWidth; c.height = window.innerHeight; draw() }
        window.addEventListener('resize', fit)
        let img=null, sel=null, drag=null, scaleX=1, scaleY=1
        async function init(){
          const primary = screen.getPrimaryDisplay()
          const scale = primary.scaleFactor||1
          const size={width:Math.floor(primary.size.width*scale),height:Math.floor(primary.size.height*scale)}
          const srcs = await desktopCapturer.getSources({ types:['screen'], thumbnailSize:size })
          const s = srcs.find(x=>x.display_id===String(primary.id))||srcs[0]
          img = new Image(); img.onload=()=>{ fit() }; img.src = s.thumbnail.toDataURL()
          scaleX = s.thumbnail.getSize().width / window.innerWidth
          scaleY = s.thumbnail.getSize().height / window.innerHeight
        }
        function draw(){ ctx.clearRect(0,0,c.width,c.height); if(img){ ctx.drawImage(img,0,0,c.width,c.height) } if(sel){ ctx.save(); ctx.strokeStyle='#10b981'; ctx.setLineDash([6,4]); ctx.lineWidth=2; ctx.strokeRect(sel.x,sel.y,sel.w,sel.h); ctx.restore() } }
        c.addEventListener('mousedown', e=>{ drag={x:e.clientX,y:e.clientY}; sel={x:e.clientX,y:e.clientY,w:0,h:0}; draw() })
        c.addEventListener('mousemove', e=>{ if(!drag) return; const x=e.clientX,y=e.clientY; sel={x:Math.min(drag.x,x),y:Math.min(drag.y,y),w:Math.abs(x-drag.x),h:Math.abs(y-drag.y)}; draw() })
        window.addEventListener('mouseup', ()=>{ drag=null })
        document.getElementById('cancel').onclick=()=>{ ipcRenderer.invoke('overlay:close') }
        document.getElementById('scan').onclick=()=>{
          if(!img||!sel||sel.w<5||sel.h<5) { ipcRenderer.invoke('overlay:close'); return }
          const crop = { x: Math.floor(sel.x*scaleX), y: Math.floor(sel.y*scaleY), w: Math.floor(sel.w*scaleX), h: Math.floor(sel.h*scaleY) }
          const tmp = document.createElement('canvas'); tmp.width=crop.w; tmp.height=crop.h
          const tctx = tmp.getContext('2d'); tctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0,0,crop.w,crop.h)
          const dataUrl = tmp.toDataURL('image/png')
          ipcRenderer.invoke('overlay:emit', dataUrl).then(()=> ipcRenderer.invoke('overlay:close'))
        }
        init()
      </script>
    </body></html>`
    overlayWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHtml))
    overlayWindow.on('closed', () => { overlayWindow = null })
  } catch {}
})

ipcMain.handle('overlay:close', async () => {
  try { overlayWindow?.close(); overlayWindow = null } catch {}
})

ipcMain.handle('overlay:emit', async (_evt, dataUrl: string) => {
  try {
    // Decode QR from dataUrl in main to avoid shipping more deps; send raw image to renderer to decode using existing jsQR
    mainWindow?.webContents.send('overlay:result', dataUrl)
  } catch {}
})


