import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { TopBar } from './TopBar'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setSelectedVaultId, toggleSidebar, setSelectedItemId, setSearchQuery } from '../../features/ui/uiSlice'
import { getVaultsIndexSecretNameWithOverrides } from '../../services/vaultPaths'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const sidebarCollapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-background">
      <TopBar />
      <div className={`grid min-h-0 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-[52px_1fr]' : 'grid-cols-[224px_1fr]'}`}>
        <aside className={`bg-sidebar border-r border-sidebar-border flex flex-col min-h-0 transition-all duration-300 ${sidebarCollapsed ? 'overflow-hidden' : ''}`}>
          {/* Header with logo and toggle */}
          <div className={`${sidebarCollapsed ? 'p-2' : 'p-5'} border-b border-sidebar-border`}>
            {sidebarCollapsed ? (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => dispatch(toggleSidebar())}
                  className="w-8 h-8 rounded hover:bg-sidebar-hover flex items-center justify-center transition-colors flex-shrink-0"
                  title={t('nav.categories')}
                  aria-label="Expand sidebar"
                >
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
                  </svg>
                </div>
                <span className="font-semibold text-base text-foreground">{t('app.title')}</span>
                <button 
                  onClick={() => dispatch(toggleSidebar())}
                  className="ml-auto w-5 h-5 rounded hover:bg-sidebar-hover flex items-center justify-center transition-colors flex-shrink-0"
                  aria-label="Collapse sidebar"
                >
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Vaults section */}
          <div className="flex-1 overflow-auto">
            {!sidebarCollapsed && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('vault.vaults')}
                  </span>
                </div>
                <VaultsList />
              </div>
            )}

            {/* Categories navigation */}
            <div className={`border-t border-sidebar-border ${sidebarCollapsed ? 'p-1.5' : 'p-3'}`}>
              {!sidebarCollapsed && (
                <div className="mb-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('nav.categories')}
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground'
                    }
                  `} 
                  to="/passwords"
                  title={sidebarCollapsed ? t('nav.passwords') : undefined}
                >
                  <svg className="w-[12.42px] h-[12.42px] flex-shrink-0" viewBox="0 0 21.6 21.6" fill="currentColor">
                    <path d="M16.2 9V7.2a5.4 5.4 0 1 0-10.8 0V9H3.6A1.8 1.8 0 0 0 1.8 10.8v7.2A1.8 1.8 0 0 0 3.6 19.8h14.4a1.8 1.8 0 0 0 1.8-1.8v-7.2A1.8 1.8 0 0 0 18 9h-1.8zm-9-1.8a3.6 3.6 0 1 1 7.2 0V9h-7.2V7.2zm10.8 10.8H3.6v-7.2h14.4v7.2zm-7.2-3.6a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 0 1-3.6 0z" fill="currentColor" />
                  </svg>
                  {!sidebarCollapsed && t('nav.passwords')}
                </NavLink>

                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground'
                    }
                  `} 
                  to="/api-keys"
                  title={sidebarCollapsed ? t('nav.apiKeys') : undefined}
                >
                  <svg className="w-[10.35px] h-[10.35px] flex-shrink-0" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M17.408 3.412a1.974 1.974 0 0 0 0-2.82 1.973 1.973 0 0 0-2.819 0l-.29.29-.59-.59a1.009 1.009 0 0 0-1.65.35l-.35-.35a1.004 1.004 0 1 0-1.42 1.42l.35.35a1.033 1.033 0 0 0-.58.58l-.35-.35a1.004 1.004 0 0 0-1.42 1.42L9.879 5.3l-3.02 3.01c-.01.01-.02.03-.03.04A4.885 4.885 0 0 0 5 8a5 5 0 1 0 5 5 4.885 4.885 0 0 0-.35-1.83c.01-.01.03-.02.04-.03l7.718-7.728zM5 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" fillRule="evenodd"/>
                  </svg>
                  {!sidebarCollapsed && t('nav.apiKeys')}
                </NavLink>
                
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground'
                    }
                  `} 
                  to="/notes"
                  title={sidebarCollapsed ? t('nav.notes') : undefined}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {!sidebarCollapsed && t('nav.notes')}
                </NavLink>
                
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground'
                    }
                  `} 
                  to="/cards"
                  title={sidebarCollapsed ? t('nav.cards') : undefined}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {!sidebarCollapsed && t('nav.cards')}
                </NavLink>
                
                {/* team vaults removed */}
              </nav>
            </div>
          </div>
        </aside>
        
        <main className="bg-background min-h-0 overflow-hidden" key={selectedVaultId}>
          {children}
        </main>
      </div>
    </div>
  )
}

function VaultsList(): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const selected = useSelector((s: RootState) => s.ui.selectedVaultId)
  const user = useSelector((s: RootState) => s.auth.user)
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsProfile = useSelector((s: RootState) => s.ui.awsProfile)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const [customVaults, setCustomVaults] = useState<Array<{ id: string; name: string }>>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [vaultName, setVaultName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingVaults, setIsLoadingVaults] = useState(true)

  const baseItems = useMemo(() => ([
    { id: 'personal', name: t('vault.personal') as string, icon: 'user', color: 'bg-blue-500' },
    { id: 'work', name: t('vault.work') as string, icon: 'briefcase', color: 'bg-purple-500' },
  ]), [t])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setIsLoadingVaults(true)
      if (!user?.uid) { setIsLoadingVaults(false); return }
      try {
        const profile = awsProfile
        const accountId = awsAccountId
        const region = awsRegion || (await (window as any).cloudpass?.awsGetDefaultRegion(profile)) || 'us-east-1'
        const name = getVaultsIndexSecretNameWithOverrides({ uid: user.uid, accountIdOverride: accountId, regionOverride: region, email: user?.email })
        const secret = await (window as any).cloudpass?.vaultRead(region, name, profile)
        if (!mounted) return
        if (secret) {
          const parsed = JSON.parse(secret || '[]') as Array<{ id: string; name: string }>
          setCustomVaults(Array.isArray(parsed) ? parsed : [])
        } else {
          setCustomVaults([])
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingVaults(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.uid, user?.email, awsRegion, awsProfile, awsAccountId])

  async function createVaultByName(name: string): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) return
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)
    if (!slug) return
    setIsSaving(true)
    try {
      if (!user?.uid) return
      const profile = awsProfile
      const accountId = awsAccountId
      const region = awsRegion || (await (window as any).cloudpass?.awsGetDefaultRegion(profile)) || 'us-east-1'
      const indexName = getVaultsIndexSecretNameWithOverrides({ uid: user.uid, accountIdOverride: accountId, regionOverride: region, email: user?.email })
      const current = await (window as any).cloudpass?.vaultRead(region, indexName, profile)
      const parsed = current ? (JSON.parse(current) as Array<{ id: string; name: string }>) : []
      const next = [...parsed.filter(v => v.id !== slug), { id: slug, name: trimmed }]
      await (window as any).cloudpass?.vaultWrite(region, indexName, JSON.stringify(next), profile)
      setCustomVaults(next)
      dispatch(setSelectedVaultId(slug))
      setIsAddOpen(false)
      setVaultName('')
    } catch {
      // ignore
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      {isLoadingVaults ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg animate-pulse">
              <div className="w-5 h-5 rounded-md bg-muted-foreground/20 flex-shrink-0" />
              <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
            </div>
          ))}
        </>
      ) : (
      [...baseItems, ...customVaults].map((vault: any) => (
        <button 
          key={vault.id} 
          onClick={() => {
            dispatch(setSelectedVaultId(vault.id))
            // Reset current selection and search when switching vaults
            dispatch(setSelectedItemId(null))
            dispatch(setSearchQuery(''))
          }} 
          className={`
            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-left
            ${selected === vault.id 
              ? 'bg-sidebar-active text-primary shadow-sm' 
              : 'text-foreground hover:bg-sidebar-hover'
            }
          `}
        >
          <div className={`w-5 h-5 rounded-md ${vault.color ? vault.color : 'bg-muted-foreground'} flex items-center justify-center flex-shrink-0`}>
            {vault.icon === 'user' && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
            {vault.icon === 'briefcase' && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            )}
            {vault.icon === 'users' && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            )}
            {!vault.icon && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            )}
          </div>
          <span className="truncate">{vault.name}</span>
          {selected === vault.id && (
            <div className="ml-auto w-1 h-1 bg-primary rounded-full"></div>
          )}
        </button>
      ))
      )}
      
      <button onClick={() => setIsAddOpen(true)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-sidebar-hover mt-2">
        <div className="w-5 h-5 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span>{t('vault.addVault')}</span>
      </button>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setIsAddOpen(false); setVaultName('') } }}>
          <div className="bg-background border border-border rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('vault.addVault')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('vault.enterVaultName')}</label>
                <Input
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createVaultByName(vaultName) } }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setIsAddOpen(false); setVaultName('') }} disabled={isSaving}>
                  {t('actions.cancel')}
                </Button>
                <Button onClick={() => void createVaultByName(vaultName)} disabled={isSaving || !vaultName.trim()}>
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {t('actions.create')}
                    </span>
                  ) : t('actions.create')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


