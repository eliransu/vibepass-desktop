import { app, BrowserWindow, shell, Menu, ipcMain, systemPreferences } from 'electron'
import keytar from 'keytar'
import Store from 'electron-store'
import { createSecretsClient, getSecret, createSecret, putSecret, deleteSecret, listAppSecrets, upsertSecretByName } from '../shared/aws/secretsManager'
import path from 'node:path'
import http from 'node:http'
import { URL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import { autoUpdater } from 'electron-updater'
import { spawn } from 'node:child_process'
import { execFile, execFileSync } from 'node:child_process'

let mainWindow: BrowserWindow | null = null
const store = new Store<{ [key: string]: unknown }>({ name: 'vibepass' })
// Removed blur-based auto-lock; we only lock on hide now

// Minimal INI parser to read ~/.aws/config without external typings
function parseIni(input: string): Record<string, any> {
  const result: Record<string, any> = {}
  let current: string | null = null
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue
    if (line.startsWith('[') && line.endsWith(']')) {
      current = line.slice(1, -1).trim()
      if (!result[current]) result[current] = {}
      continue
    }
    const idx = line.indexOf('=')
    if (idx > -1) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      const target = current ? result[current] : result
      target[key] = value
    }
  }
  return result
}

function ensureAwsEnv(): void {
  const defaultPath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
  if (!process.env.PATH) {
    process.env.PATH = defaultPath
  } else if (!process.env.PATH.includes('/opt/homebrew/bin') && !process.env.PATH.includes('/usr/local/bin')) {
    process.env.PATH = `${defaultPath}:${process.env.PATH}`
  }
  if (!process.env.AWS_SDK_LOAD_CONFIG) {
    process.env.AWS_SDK_LOAD_CONFIG = '1'
  }
}

function resolveAwsCliPath(): string | null {
  const candidates: string[] = []
  if (process.env.AWS_CLI_PATH && process.env.AWS_CLI_PATH.trim().length > 0) {
    candidates.push(process.env.AWS_CLI_PATH)
  }
  candidates.push('/opt/homebrew/bin/aws', '/usr/local/bin/aws', '/usr/bin/aws', '/bin/aws')
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore
    }
  }
  try {
    const which = execFileSync('/usr/bin/which', ['aws'], { encoding: 'utf8' }).trim()
    if (which) return which
  } catch {
    // ignore
  }
  return null
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
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
    const FIXED_PORT = Number(process.env.VIBEPASS_PORT || 17896)
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

  // Security: allow Firebase/Google auth popups, otherwise open externally
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const allowedHosts = [
        'accounts.google.com',
        'oauth2.googleapis.com',
        'firebaseapp.com',
        'googleusercontent.com',
      ]
      const { hostname } = new URL(url)
      if (allowedHosts.some((h) => hostname.endsWith(h))) {
        return { action: 'allow' }
      }
    } catch {
      // fallthrough
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  ensureAwsEnv()
  createMainWindow()
  Menu.setApplicationMenu(null)
  if (!app.isPackaged) return
  if (process.env.VIBEPASS_AUTOUPDATE === '1') {
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
    const hasSecret = (await keytar.getPassword('VibePass-Biometric', 'master-password')) !== null
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
    await keytar.setPassword('VibePass-Biometric', 'master-password', masterPassword)
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
        await systemPreferences.promptTouchID('Unlock VibePass')
      }
      const password = await keytar.getPassword('VibePass-Biometric', 'master-password')
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

// AWS Secrets Manager via IPC - renderer sends already encrypted strings
ipcMain.handle('team:list', async (_evt, region: string, ids: string[], _profile?: string) => {
  if (_profile && _profile !== 'default') {
    process.env.AWS_PROFILE = _profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
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
  if (_profile && _profile !== 'default') {
    process.env.AWS_PROFILE = _profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  return createSecret(client, name, secretString)
})

ipcMain.handle('team:update', async (_evt, region: string, id: string, secretString: string, profile?: string) => {
  if (profile && profile !== 'default') {
    process.env.AWS_PROFILE = profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  await putSecret(client, id, secretString)
  return true
})

ipcMain.handle('team:delete', async (_evt, region: string, id: string, force: boolean, profile?: string) => {
  if (profile && profile !== 'default') {
    process.env.AWS_PROFILE = profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  await deleteSecret(client, id, force)
  return true
})

// List VibePass-tagged secrets
ipcMain.handle('team:list-app', async (_evt, region: string, _profile?: string) => {
  if (_profile && _profile !== 'default') {
    process.env.AWS_PROFILE = _profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  return listAppSecrets(client)
})

// Get a secret value by ARN/id
ipcMain.handle('team:get-secret-value', async (_evt, region: string, secretId: string, profile?: string) => {
  if (profile && profile !== 'default') {
    process.env.AWS_PROFILE = profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  return (await getSecret(client, secretId)) ?? null
})

// Consolidated vault secret read/write by name
ipcMain.handle('vault:read', async (_evt, region: string, name: string, profile?: string) => {
  if (profile && profile !== 'default') {
    process.env.AWS_PROFILE = profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  try {
    return (await getSecret(client, name)) ?? null
  } catch {
    return null
  }
})

ipcMain.handle('vault:write', async (_evt, region: string, name: string, secretString: string, profile?: string) => {
  if (profile && profile !== 'default') {
    process.env.AWS_PROFILE = profile
  } else {
    delete process.env.AWS_PROFILE
  }
  const client = createSecretsClient(region)
  await upsertSecretByName(client, name, secretString)
  return true
})

// AWS Profile management
ipcMain.handle('aws:get-profiles', async () => {
  try {
    const awsConfigPath = path.join(os.homedir(), '.aws', 'config')
    
    if (!fs.existsSync(awsConfigPath)) {
      return { default: 'Default' }
    }
    
    const configContent = fs.readFileSync(awsConfigPath, 'utf-8')
    const profiles: Record<string, string> = { default: 'Default' }
    
    // Parse AWS config file for profiles
    const lines = configContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[profile ')) {
        const profileName = trimmed.substring('[profile '.length, trimmed.length - 1)
        profiles[profileName] = profileName
      } else if (trimmed === '[default]') {
        profiles.default = 'Default'
      }
    }
    
    return profiles
  } catch (error) {
    console.error('Failed to read AWS profiles:', error)
    return { default: 'Default' }
  }
})

// Run AWS SSO login in a child process
ipcMain.handle('aws:sso-login', async (_evt, profile: string) => {
  try {
    ensureAwsEnv()
    const env = { ...process.env, AWS_PROFILE: profile }
    const awsCli = resolveAwsCliPath()
    if (!awsCli) {
      throw new Error('AWS CLI not found. Install AWS CLI v2 and/or set AWS_CLI_PATH to the aws binary.')
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(awsCli, ['sso', 'login', '--profile', profile], { env, stdio: 'ignore' })
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`aws sso login exited with code ${code}`))
      })
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SSO failed' }
  }
})

// Get AWS account id via AWS CLI (avoids bundling extra SDK client)
ipcMain.handle('aws:get-account', async (_evt, profile?: string) => {
  try {
    ensureAwsEnv()
    const env = { ...process.env }
    if (profile && profile !== 'default') {
      env.AWS_PROFILE = profile
    } else {
      delete env.AWS_PROFILE
    }
    const awsCli = resolveAwsCliPath()
    if (!awsCli) {
      throw new Error('AWS CLI not found. Install AWS CLI v2 and/or set AWS_CLI_PATH to the aws binary.')
    }
    const output: string = await new Promise((resolve, reject) => {
      execFile(awsCli, ['sts', 'get-caller-identity', '--output', 'json'], { env }, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout || '')
      })
    })
    const parsed = JSON.parse(output || '{}') as { Account?: string }
    return parsed?.Account || null
  } catch (e) {
    return null
  }
})

// Read region default from ~/.aws/config under the selected profile.
ipcMain.handle('aws:get-default-region', async (_evt, profile?: string) => {
  try {
    const awsConfigPath = path.join(os.homedir(), '.aws', 'config')
    if (!fs.existsSync(awsConfigPath)) return null
    const cfgRaw = fs.readFileSync(awsConfigPath, 'utf-8')
    const parsed = parseIni(cfgRaw)
    const profileKey = profile && profile !== 'default' ? `profile ${profile}` : 'default'
    const prof = parsed?.[profileKey]
    if (prof && typeof prof.region === 'string' && prof.region.trim().length > 0) {
      return prof.region.trim()
    }
    // Try AWS CLI for robustness
    try {
      const awsCli = resolveAwsCliPath()
      if (awsCli) {
        const args = ['configure', 'get', 'region']
        if (profile && profile !== 'default') args.push('--profile', profile)
        const output = execFileSync(awsCli, args, { encoding: 'utf8' }).trim()
        if (output) return output
      }
    } catch {}
    // Fallback: environment or common default
    if (process.env.AWS_REGION && process.env.AWS_REGION.trim()) return process.env.AWS_REGION.trim()
    if (process.env.AWS_DEFAULT_REGION && process.env.AWS_DEFAULT_REGION.trim()) return process.env.AWS_DEFAULT_REGION.trim()
    return 'us-east-1'
  } catch {
    return 'us-east-1'
  }
})


