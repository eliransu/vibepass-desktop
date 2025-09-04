import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setAwsRegion as setAwsRegionAction, setAwsProfile as setAwsProfileAction, setAwsAccountId } from '../../features/ui/uiSlice'
  
export function TopBar(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'dark')
  const user = useSelector((s: RootState) => s.auth.user)
  const awsAccountIdState = useSelector((s: RootState) => s.ui.awsAccountId)
  const dispatch = useDispatch()
  const [awsProfiles, setAwsProfiles] = useState<Record<string, string>>({})
  const [awsProfile, setAwsProfile] = useState<string>(() => localStorage.getItem('awsProfile') || 'default')
  const [awsRegion, setAwsRegion] = useState<string>('us-east-1')
  const [ssoLoading, setSsoLoading] = useState<boolean>(false)
  // AWS region order: us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-west-3, eu-central-1, eu-north-1, ap-south-1, ap-northeast-1, ap-northeast-2, ap-southeast-1, ap-southeast-2, etc.
  const regions = useMemo(() => [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
    'ap-south-1', 'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'
  ], [])
  
  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  
  const currentLang = (i18n.language ?? (i18n as any).resolvedLanguage ?? 'en') as string
  const isRtl = currentLang.startsWith('he')
  const arrowSideClass = isRtl ? 'left-1.5' : 'right-1.5'
  const padSideClass = isRtl ? 'pl-7' : 'pr-7'
  useEffect(() => {
    // Set direction by language
    const dir = currentLang.startsWith('he') ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
  }, [currentLang])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const profs = await window.cloudpass.awsGetProfiles()
        if (!mounted) return
        setAwsProfiles(profs)
        const keys = Object.keys(profs || {})
        // Pick current profile if valid; otherwise prefer first non-default when available
        let nextProfile = awsProfile && keys.includes(awsProfile) ? awsProfile : undefined
        if (!nextProfile) {
          const nonDefault = keys.find((k) => k !== 'default')
          nextProfile = nonDefault || (keys[0] || 'default')
        }
        // If still 'default' but there is a non-default, prefer non-default
        if (nextProfile === 'default') {
          const nonDefault = keys.find((k) => k !== 'default')
          if (nonDefault) nextProfile = nonDefault
        }
        setAwsProfile(nextProfile)
        // Always resolve region from config for the chosen profile
        let defaultRegion = 'us-east-1'
        try {
          const cfgRegion = await window.cloudpass.awsGetDefaultRegion(nextProfile)
          if (cfgRegion && typeof cfgRegion === 'string') defaultRegion = cfgRegion
        } catch {}
        if (!mounted) return
        setAwsRegion(defaultRegion)
        void persistAws(nextProfile, defaultRegion)
      } catch {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  async function persistAws(profile: string, region: string) {
    localStorage.setItem('awsProfile', profile)
    // Do not persist awsRegion; it is resolved from ~/.aws/config each time
    void window.cloudpass.storeSet('awsProfile', profile)
    dispatch(setAwsProfileAction(profile))
    dispatch(setAwsRegionAction(region))
    // Clear account context immediately to avoid showing data from previous profile
    localStorage.removeItem('awsAccountId')
    void window.cloudpass.storeSet('awsAccountId', '')
    dispatch(setAwsAccountId(''))
    try {
      const account = await window.cloudpass.awsGetAccount(profile)
      if (account) {
        localStorage.setItem('awsAccountId', account)
        void window.cloudpass.storeSet('awsAccountId', account)
        dispatch(setAwsAccountId(account))
      }
      // If missing/expired, avoid popups; inline screens will prompt user
    } catch {}
  }
  
  // Auto-apply selection and attempt SSO right after user login
  useEffect(() => {
    if (!user?.uid) return
    void persistAws(awsProfile, awsRegion)
    // ;(async () => {
    //   try {
    //     const res = await window.cloudpass.awsSsoLogin(awsProfile)
    //     if (!res?.ok) {
    //       alert(t('team.ssoLoginCta') as string)
    //     } else {
    //       const account = await window.cloudpass.awsGetAccount(awsProfile)
    //       if (!account) alert(t('team.ssoLoginCta') as string)
    //     }
    //   } catch {
    //     alert(t('team.ssoLoginCta') as string)
    //   }
    // })()
  }, [user?.uid])
  
  return (
    <header className="bg-background border-b border-border px-5 flex items-center justify-between" style={{height: '64px'}}>
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2.5">
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
            <svg className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {/* AWS Profile selector (first) */}
        <div className="relative inline-flex items-center" style={{height: '40px'}}>
          <label className="mr-2 text-xs text-muted-foreground hidden sm:block">{t('team.selectAwsProfile') as string}</label>
          <select
            className={`h-10 px-3 bg-muted/50 border border-border/40 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring ${padSideClass}`}
            style={{ WebkitAppearance: 'none', appearance: 'none' as any, MozAppearance: 'none', background: 'none', backgroundImage: 'none' }}
            value={awsProfile}
            onChange={async (e) => {
              const p = e.target.value
              setAwsProfile(p)
              // Always resolve region from config for selected profile
              let cfgRegion = 'us-east-1'
              try {
                const r = await window.cloudpass.awsGetDefaultRegion(p)
                if (r) cfgRegion = r
              } catch {}
              setAwsRegion(cfgRegion)
              void persistAws(p, cfgRegion)
            }}
            title={t('team.awsProfile') as string}
          >
            {Object.keys(awsProfiles).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <svg className={`absolute ${arrowSideClass} top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* AWS Region selector (second) */}
        <div className="relative inline-flex items-center" style={{height: '40px'}}>
          <select
            className={`h-10 px-3 bg-muted/50 border border-border/40 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring ${padSideClass}`}
            style={{ WebkitAppearance: 'none', appearance: 'none' as any, MozAppearance: 'none', background: 'none', backgroundImage: 'none' }}
            value={awsRegion}
            onChange={async (_e) => {
              // Disable manual selection; always use ~/.aws/config
              let cfgRegion = awsRegion
              try {
                const r = await window.cloudpass.awsGetDefaultRegion(awsProfile)
                if (r) cfgRegion = r
              } catch {}
              setAwsRegion(cfgRegion)
              void persistAws(awsProfile, cfgRegion)
            }}
            title={t('team.awsRegion') as string}
          >
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <svg className={`absolute ${arrowSideClass} top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* AWS SSO Login */}
        <button
          className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${!awsAccountIdState ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30' : 'bg-muted/50 border-transparent'}`}
          onClick={async () => {
            try {
              setSsoLoading(true)
              await window.cloudpass.awsSsoLogin(awsProfile)
              // Attempt fetching account after SSO to verify session
              const account = await window.cloudpass.awsGetAccount(awsProfile)
              if (account) {
                localStorage.setItem('awsAccountId', account)
                void window.cloudpass.storeSet('awsAccountId', account)
                dispatch(setAwsAccountId(account))
              } else {
                // Clear any stale account id so UI reflects missing/expired SSO
                localStorage.removeItem('awsAccountId')
                void window.cloudpass.storeSet('awsAccountId', '')
                dispatch(setAwsAccountId(''))
              }
            } catch {
              // On failure, ensure stale account id is cleared
              localStorage.removeItem('awsAccountId')
              void window.cloudpass.storeSet('awsAccountId', '')
              dispatch(setAwsAccountId(''))
            } finally {
              setSsoLoading(false)
            }
          }}
          disabled={ssoLoading}
          title={t('team.ssoLogin') as string}
        >
          {t('team.ssoLogin')}
        </button>

        {/* Theme toggle */}
        <button 
          className="h-8 w-8 bg-muted/50 border border-transparent rounded-lg flex items-center justify-center hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* User indicator (no sign out) */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary-foreground text-xs font-medium">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-foreground">{user.displayName || 'User'}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}


