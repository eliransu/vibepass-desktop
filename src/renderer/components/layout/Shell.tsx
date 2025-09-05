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
import { IconButton } from '../ui/icon-button'
import { Icon, PasswordIcon, ApiKeyIcon, NotesIcon, CardsIcon, LoadingIcon } from '../ui/icon'

export function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const sidebarCollapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-background">
      <TopBar />
      <div className={`grid min-h-0 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-[56px_1fr]' : 'grid-cols-[280px_1fr]'}`}>
        <aside className={`bg-sidebar border-r border-sidebar-border flex flex-col min-h-0 transition-all duration-300 ${sidebarCollapsed ? 'overflow-hidden' : ''} shadow-sm`}>
          {/* Header with logo and toggle */}
          <div className={`${sidebarCollapsed ? 'p-3' : 'p-6'} border-b border-sidebar-border`}>
            {sidebarCollapsed ? (
              <div className="flex items-center justify-center">
                <IconButton
                  icon="chevron-right"
                  onClick={() => dispatch(toggleSidebar())}
                  variant="ghost"
                  size="icon-sm"
                  label={t('nav.categories')}
                  className="text-muted-foreground hover:text-foreground"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Icon name="shield" size={18} className="text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg text-foreground tracking-tight">{t('app.title')}</span>
                <IconButton
                  icon="chevron-left"
                  onClick={() => dispatch(toggleSidebar())}
                  variant="ghost"
                  size="icon-sm"
                  label="Collapse sidebar"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                />
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
            <div className={`border-t border-sidebar-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
              {!sidebarCollapsed && (
                <div className="mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('nav.categories')}
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm border-primary-border' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground hover:shadow-xs border-transparent hover:border-border/50'
                    }
                  `} 
                  to="/passwords"
                  title={sidebarCollapsed ? t('nav.passwords') : undefined}
                >
                  <PasswordIcon size={16} className="flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{t('nav.passwords')}</span>
                  )}
                </NavLink>

                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm border-primary-border' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground hover:shadow-xs border-transparent hover:border-border/50'
                    }
                  `} 
                  to="/api-keys"
                  title={sidebarCollapsed ? t('nav.apiKeys') : undefined}
                >
                  <ApiKeyIcon size={16} className="flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{t('nav.apiKeys')}</span>
                  )}
                </NavLink>
                
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm border-primary-border' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground hover:shadow-xs border-transparent hover:border-border/50'
                    }
                  `} 
                  to="/notes"
                  title={sidebarCollapsed ? t('nav.notes') : undefined}
                >
                  <NotesIcon size={16} className="flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{t('nav.notes')}</span>
                  )}
                </NavLink>
                
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
                    ${isActive 
                      ? 'bg-sidebar-active text-primary shadow-sm border-primary-border' 
                      : 'text-foreground hover:bg-sidebar-hover hover:text-foreground hover:shadow-xs border-transparent hover:border-border/50'
                    }
                  `} 
                  to="/cards"
                  title={sidebarCollapsed ? t('nav.cards') : undefined}
                >
                  <CardsIcon size={16} className="flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{t('nav.cards')}</span>
                  )}
                </NavLink>
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
            <div key={i} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg animate-shimmer">
              <div className="w-6 h-6 rounded-lg bg-muted-foreground/20 flex-shrink-0" />
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
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left interactive border
            ${selected === vault.id 
              ? 'bg-sidebar-active text-primary shadow-sm border-primary-border' 
              : 'text-foreground hover:bg-sidebar-hover hover:shadow-xs border-transparent hover:border-border/50'
            }
          `}
        >
          <div className={`w-6 h-6 rounded-lg ${vault.color ? vault.color : 'bg-gradient-primary'} flex items-center justify-center flex-shrink-0 shadow-xs`}>
            {vault.icon === 'user' && (
              <Icon name="user" size={12} className="text-white" />
            )}
            {vault.icon === 'briefcase' && (
              <Icon name="briefcase" size={12} className="text-white" />
            )}
            {vault.icon === 'users' && (
              <Icon name="users" size={12} className="text-white" />
            )}
            {!vault.icon && (
              <Icon name="lock" size={12} className="text-white" />
            )}
          </div>
          <span className="truncate flex-1">{vault.name}</span>
          {selected === vault.id && (
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow"></div>
          )}
        </button>
      ))
      )}
      
      <button 
        onClick={() => setIsAddOpen(true)} 
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-sidebar-hover interactive mt-2"
      >
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0 hover:border-primary/50 transition-colors">
          <Icon name="plus" size={12} />
        </div>
        <span className="truncate">{t('vault.addVault')}</span>
      </button>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) { setIsAddOpen(false); setVaultName('') } }}>
          <div className="bg-background border border-border rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-foreground mb-4 tracking-tight">{t('vault.addVault')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('vault.enterVaultName')}</label>
                <Input
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createVaultByName(vaultName) } }}
                  autoFocus
                  className="focus-enhanced"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="secondary" 
                  onClick={() => { setIsAddOpen(false); setVaultName('') }} 
                  disabled={isSaving}
                  size="sm"
                >
                  {t('actions.cancel')}
                </Button>
                <Button 
                  onClick={() => void createVaultByName(vaultName)} 
                  disabled={isSaving || !vaultName.trim()}
                  size="sm"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <LoadingIcon size={14} />
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


