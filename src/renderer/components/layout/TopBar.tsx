import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setAwsRegion as setAwsRegionAction, setAwsAccountId } from '../../features/ui/uiSlice'
import { IconButton } from '../ui/icon-button'
import { Icon } from '../ui/icon'
import { ConfirmDialog } from '../ui/confirm-dialog'
import AceEditor from 'react-ace'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/theme-github'
import 'ace-builds/src-noconflict/theme-monokai'
import 'ace-builds/src-noconflict/ext-language_tools'
  
export function TopBar(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'dark')
  const user = useSelector((s: RootState) => s.auth.user)
  // Keep account id in store; UI does not directly use it here
  useSelector((s: RootState) => s.ui.awsAccountId)
  const dispatch = useDispatch()
  const [showProfileError, setShowProfileError] = useState(false)
  const [config, setConfig] = useState<any | null>(null)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configText, setConfigText] = useState('')
  const [configError, setConfigError] = useState<string | null>(null)
  
  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  
  const currentLang = (i18n.language ?? (i18n as any).resolvedLanguage ?? 'en') as string
  useEffect(() => {
    // Set direction by language
    const dir = currentLang.startsWith('he') ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
  }, [currentLang])

  const persistFromConfig = useCallback(async (cfg: any | null) => {
    if (!cfg) return
    const region = cfg?.region || cfg?.ssoRegion
    const accountId = cfg?.accountId || cfg?.ssoAccountId
    const team = (cfg?.team || '') as string
    const department = (cfg?.department || '') as string
    if (region) {
      dispatch(setAwsRegionAction(region))
    }
    if (accountId) {
      localStorage.setItem('awsAccountId', accountId)
      try { await window.cloudpass.storeSet('awsAccountId', accountId) } catch {}
      dispatch(setAwsAccountId(accountId))
    }
    if (team) {
      try {
        localStorage.setItem('team', team)
        await window.cloudpass.storeSet('team', team)
      } catch {}
    }
    if (department) {
      try {
        localStorage.setItem('department', department)
        await window.cloudpass.storeSet('department', department)
      } catch {}
    }
  }, [dispatch])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cfg = await window.cloudpass.configGet()
        if (!mounted) return
        setConfig(cfg)
        if (cfg) {
          await persistFromConfig(cfg)
        }
      } catch {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [persistFromConfig])
  
  useEffect(() => {
    if (!user?.uid || !config) return
    void (async () => { await persistFromConfig(config) })()
  }, [user?.uid, config, persistFromConfig])

  // Simple JSON validation function to replace Zod
  function validateConfig(parsed: any): { isValid: boolean; error?: string } {
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Configuration must be an object' }
    }

    const type = parsed.type
    if (type !== 'sso' && type !== 'keys') {
      return { isValid: false, error: 'Type must be either "sso" or "keys"' }
    }

    // Department is mandatory for all configurations
    if (!parsed.department || typeof parsed.department !== 'string') {
      return { isValid: false, error: 'department is required' }
    }

    if (type === 'sso') {
      if (!parsed.ssoStartUrl || typeof parsed.ssoStartUrl !== 'string') {
        return { isValid: false, error: 'ssoStartUrl is required for SSO type' }
      }
      if (!parsed.ssoRegion || typeof parsed.ssoRegion !== 'string') {
        return { isValid: false, error: 'ssoRegion is required for SSO type' }
      }
      if (!parsed.ssoAccountId || typeof parsed.ssoAccountId !== 'string') {
        return { isValid: false, error: 'ssoAccountId is required for SSO type' }
      }
      if (!parsed.ssoRoleName || typeof parsed.ssoRoleName !== 'string') {
        return { isValid: false, error: 'ssoRoleName is required for SSO type' }
      }
      try {
        new URL(parsed.ssoStartUrl)
      } catch {
        return { isValid: false, error: 'ssoStartUrl must be a valid URL' }
      }
    }

    if (type === 'keys') {
      if (!parsed.accessKeyId || typeof parsed.accessKeyId !== 'string') {
        return { isValid: false, error: 'accessKeyId is required for keys type' }
      }
      if (!parsed.secretAccessKey || typeof parsed.secretAccessKey !== 'string') {
        return { isValid: false, error: 'secretAccessKey is required for keys type' }
      }
    }

    return { isValid: true }
  }

  function normalizeRawConfig(raw: any): any {
    const get = (obj: any, candidates: string[]): any => {
      for (const key of candidates) {
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
        const alt = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
        if (obj && Object.prototype.hasOwnProperty.call(obj, alt)) return obj[alt]
      }
      return undefined
    }
    const explicitType = (raw?.type || raw?.provider || '').toString().toLowerCase()
    const inferred: 'sso' | 'keys' | undefined = explicitType.includes('sso')
      ? 'sso'
      : explicitType.includes('key')
        ? 'keys'
        : get(raw, ['accessKeyId', 'aws_access_key_id'])
          ? 'keys'
          : get(raw, ['ssoStartUrl', 'startUrl', 'sso_start_url'])
            ? 'sso'
            : undefined
    const type: 'sso' | 'keys' = inferred || 'sso'
    const region = get(raw, ['region', 'ssoRegion', 'sso_region'])
    const accountId = get(raw, ['accountId', 'ssoAccountId', 'sso_account_id'])
    const team = get(raw, ['team'])
    const department = get(raw, ['department'])
    if (type === 'keys') {
      return {
        type: 'keys',
        region,
        accountId,
        team,
        department,
        accessKeyId: get(raw, ['accessKeyId', 'aws_access_key_id']),
        secretAccessKey: get(raw, ['secretAccessKey', 'aws_secret_access_key']),
        sessionToken: get(raw, ['sessionToken', 'aws_session_token']),
      }
    }
    return {
      type: 'sso',
      region,
      accountId,
      team,
      department,
      ssoStartUrl: get(raw, ['ssoStartUrl', 'startUrl', 'sso_start_url']),
      ssoRegion: get(raw, ['ssoRegion', 'region', 'sso_region']),
      ssoAccountId: get(raw, ['ssoAccountId', 'accountId', 'sso_account_id']),
      ssoRoleName: get(raw, ['ssoRoleName', 'roleName', 'sso_role_name']),
    }
  }

  async function openConfigModal(prefill?: any | null): Promise<void> {
    try {
      setConfigError(null)
      const latest = await window.cloudpass.configGet()
      const toFill = (latest ?? prefill) ?? {
        type: 'sso',
        ssoStartUrl: 'https://example.awsapps.com/start',
        ssoRegion: 'us-east-1',
        ssoAccountId: '123456789012',
        ssoRoleName: 'AdministratorAccess',
        region: 'us-east-1',
        department: 'engineering',
        team: 'backend'
      }
      setConfigText(JSON.stringify(toFill, null, 2))
    } catch {
      const fallback = {
        type: 'sso',
        ssoStartUrl: 'https://example.awsapps.com/start',
        ssoRegion: 'us-east-1',
        ssoAccountId: '123456789012',
        ssoRoleName: 'AdministratorAccess',
        region: 'us-east-1',
        department: 'engineering',
        team: 'backend'
      }
      setConfigText(JSON.stringify(fallback, null, 2))
    }
    setIsConfigModalOpen(true)
  }

  async function saveConfig(): Promise<void> {
    try {
      setConfigError(null)
      const parsed = JSON.parse(configText)
      const normalized = normalizeRawConfig(parsed)
      
      // Use simple validation instead of Zod
      const validation = validateConfig(normalized)
      if (!validation.isValid) {
        setConfigError(validation.error || 'Invalid configuration')
        return
      }

      await window.cloudpass.configSet(normalized)
      setConfig(normalized)
      await persistFromConfig(normalized)
      // Ensure other areas immediately see new config
      try { await window.cloudpass.storeSet('awsConfigReloadAt', Date.now()) } catch {}
      setIsConfigModalOpen(false)
      
      // Reload the app after successful save
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (e: any) {
      try {
        const msg = e?.message || 'Invalid JSON'
        setConfigError(msg)
      } catch {
        setConfigError('Invalid JSON')
      }
    }
  }

  
  return (
    <header className="bg-card border-b-2 border-border px-6 flex items-center justify-between shadow-md" style={{height: '72px'}}>
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Language selector - commented out per request */}
        {false && (
          <div className="relative">
            <select 
              className="h-8 px-2.5 bg-muted/50 border border-transparent rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-7" 
              value={currentLang.startsWith('he') ? 'he' : 'en'} 
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="he">HE</option>
            </select>
            <Icon name="chevron-down" size={14} className="absolute right-1.5 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Config loader / dropdown */}
        {config ? (
          <div className="relative inline-flex items-center" style={{height: '44px'}}>
            <button
              className={`h-10 px-4 bg-secondary hover:bg-secondary-hover border-2 border-border rounded-lg text-sm font-medium focus:outline-none transition-colors shadow-sm hover:shadow-md`}
              onClick={() => void openConfigModal(config)}
              title={t('config.reload') as string}
            >
              {t('config.editProfile')}
            </button>
          </div>
        ) : (
          <button
            className="h-10 px-4 rounded-lg text-sm font-medium transition-all duration-200 border-2 shadow-sm hover:shadow-md active:scale-[0.98] bg-secondary hover:bg-secondary-hover border-border"
            onClick={() => void openConfigModal(null)}
            title={t('config.load') as string}
          >
            {t('config.loadCloudpassConfig')}
          </button>
        )}

        {/* SSO Login */}
        <button
          className="h-10 px-4 rounded-lg text-sm font-medium transition-all duration-200 border-2 shadow-sm hover:shadow-md active:scale-[0.98] bg-secondary hover:bg-secondary-hover border-border"
          onClick={async () => {
            try {
              const res = await window.cloudpass.awsSsoLogin()
              if (!res?.ok) {
                // Fallback: open SSO start URL if present
                const latest = await window.cloudpass.configGet()
                const url = latest?.ssoStartUrl || latest?.startUrl
                if (url) { await window.cloudpass.openExternal(url) }
              }
            } catch {}
          }}
          title={t('team.ssoLogin') as string}
        >
          {t('team.ssoLogin')}
        </button>

        {/* Theme toggle */}
        <IconButton
          icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          variant="ghost"
          size="icon-sm"
          className="bg-secondary hover:bg-secondary-hover border-2 border-border shadow-sm hover:shadow-md"
          iconSize={16}
        />

        {/* User indicator (no sign out) */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden shadow-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary-foreground text-sm font-semibold">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-foreground tracking-tight">{user.displayName || 'User'}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AWS Profile Error Modal (kept for compatibility; hidden if unused) */}
      <ConfirmDialog
        isOpen={showProfileError}
        onClose={() => setShowProfileError(false)}
        onConfirm={() => setShowProfileError(false)}
        title={t('auth.awsProfileError')}
        message={t('auth.noCloudpassProfile')}
        confirmText={t('actions.close')}
        variant="destructive"
      />

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsConfigModalOpen(false) }}>
          <div className="bg-card border-2 border-border rounded-2xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 tracking-tight">{t('config.title')}</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  className="h-9 px-3 rounded-lg text-sm font-medium transition-all duration-200 border-2 shadow-sm hover:shadow-md bg-secondary hover:bg-secondary-hover border-border"
                  onClick={async () => { const f = await window.cloudpass.fileOpenJson(); if (f?.content) setConfigText(f.content) }}
                >{t('config.loadFile')}</button>
                <div className="text-xs text-muted-foreground self-center">{t('config.pasteJsonHint')}</div>
              </div>
              <div className="border-2 border-border rounded-lg overflow-hidden">
                <AceEditor
                  mode="json"
                  theme={theme === 'dark' ? 'monokai' : 'github'}
                  onChange={(value) => setConfigText(value)}
                  value={configText}
                  name="config-editor"
                  width="100%"
                  height="256px"
                  fontSize={12}
                  showPrintMargin={false}
                  showGutter={true}
                  highlightActiveLine={true}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 2,
                    useWorker: false
                  }}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                  }}
                />
              </div>
              {configError && <div className="text-destructive text-sm">{configError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button className="h-9 px-3 rounded-lg text-sm font-medium border-2 bg-secondary hover:bg-secondary-hover border-border shadow-sm hover:shadow-md" onClick={() => setIsConfigModalOpen(false)}>{t('actions.cancel')}</button>
                <button className="h-9 px-3 rounded-lg text-sm font-medium border-2 bg-primary text-primary-foreground hover:opacity-90 border-primary-border shadow-sm hover:shadow-md" onClick={() => void saveConfig()}>{t('actions.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}


