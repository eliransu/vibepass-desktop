import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setSelectedVaultId, toggleSidebar, setSelectedItemId, setSearchQuery, toggleCommandPalette, setCommandPaletteOpen } from '../../features/ui/uiSlice'
import { IconButton } from '../ui/icon-button'
import { CommandPalette } from '../ui/command-palette'
import { Icon, PasswordIcon, ApiKeyIcon, NotesIcon, CardsIcon } from '../ui/icon'
import { useSafeToast } from '../../hooks/useSafeToast'

export function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const sidebarCollapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const { showToast } = useSafeToast()
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const commandOpen = useSelector((s: RootState) => s.ui.commandPaletteOpen)

  // Global AWS identity/SSO error notifications
  useEffect(() => {
    function onAwsIdentityError(e: Event): void {
      try {
        const detail = (e as CustomEvent).detail || {}
        const code = String(detail.code || '')
        const message = String(detail.message || '')
        if (code === 'SessionRequired') {
          // Suppress startup flash: do not toast on initial SSO session requirement
          return
        }
        if (code === 'SsoLoginFailed') {
          showToast(t('auth.ssoLoginFailed') as string, 'error')
          return
        }
        showToast((message && message.length > 0) ? message : (t('errors.identityFailed') as string), 'error')
      } catch {
        showToast(t('errors.identityFailed') as string, 'error')
      }
    }

    window.addEventListener('aws-identity-error', onAwsIdentityError as EventListener)
    return () => {
      window.removeEventListener('aws-identity-error', onAwsIdentityError as EventListener)
    }
  }, [showToast, t])
  
  // Global Cmd/Ctrl + K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const meta = isMac ? e.metaKey : e.ctrlKey
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        dispatch(toggleCommandPalette())
      }
      if (e.key === 'Escape') {
        dispatch(setCommandPaletteOpen(false))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch])
  
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-background">
      <div className="sticky top-0 z-50">
        <TopBar />
      </div>
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
                <span className="text-heading-4 text-foreground crisp-text">{t('app.title')}</span>
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
                  <span className="text-caption font-bold text-muted-foreground uppercase tracking-wide crisp-text">
                    {t('vault.vaults')}
                  </span>
                </div>
                <VaultsList storageMode={storageMode} />
              </div>
            )}

            {/* Categories navigation */}
            <div className={`border-t border-sidebar-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
              {!sidebarCollapsed && (
                <div className="mb-3">
                  <span className="text-caption font-bold text-muted-foreground uppercase tracking-wide crisp-text">
                    {t('nav.categories')}
                  </span>
                </div>
              )}
              <nav className="space-y-1">
                <NavLink 
                  className={({isActive}) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-semibold crisp-text transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
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
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-semibold crisp-text transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
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
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-semibold crisp-text transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
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
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-semibold crisp-text transition-all duration-200 interactive border ${sidebarCollapsed ? 'justify-center' : ''}
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
      {commandOpen && <CommandPalette onClose={() => dispatch(setCommandPaletteOpen(false))} />}
    </div>
  )
}

function VaultsList({ storageMode }: { storageMode?: 'cloud' | 'local' }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const selected = useSelector((s: RootState) => s.ui.selectedVaultId)
  const navigate = useNavigate()

  const baseItems = useMemo(() => {
    const items: Array<{ id: string; name: string; icon: string; color: string }> = [
      { id: 'personal', name: t('vault.personal') as string, icon: 'user', color: 'bg-blue-500' },
    ]
    if (storageMode === 'cloud') {
      const department = (typeof localStorage !== 'undefined' && (localStorage.getItem('department') || '')) as string
      const workName = (department && department.trim().length > 0) ? department : (t('vault.work') as string)
      items.push({ id: 'work', name: workName, icon: 'briefcase', color: 'bg-purple-500' })
    }
    return items as any[]
  }, [t, storageMode])


  return (
    <div className="space-y-1">
      {baseItems.map((vault: any) => (
        <button 
          key={vault.id} 
          onClick={() => {
            const isSwitchingVault = selected !== vault.id
            dispatch(setSelectedVaultId(vault.id))
            if (isSwitchingVault) {
              // Reset current selection and search when switching vaults
              dispatch(setSelectedItemId(null))
              dispatch(setSearchQuery(''))
              navigate('/passwords')
            }
          }} 
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-semibold crisp-text transition-all duration-200 text-left interactive border enhanced-card
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
      ))}
    </div>
  )
}


