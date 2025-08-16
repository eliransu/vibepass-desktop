import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { TopBar } from './TopBar'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setSelectedVaultId, toggleSidebar } from '../../features/ui/uiSlice'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from '../../../shared/firebase'
import { deriveTenantFromEmail } from '../../services/vaultPaths'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const sidebarCollapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-background">
      <TopBar />
      <div className={`grid min-h-0 transition-all duration-300 ${sidebarCollapsed ? 'grid-cols-[52px_1fr]' : 'grid-cols-[224px_1fr]'}`}>
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
                  <button className="w-4 h-4 rounded bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                    <svg className="w-2.5 h-2.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
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
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243A6 6 0 0121 9z" />
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
        
        <main className="bg-background min-h-0 overflow-auto">
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
  const [customVaults, setCustomVaults] = useState<Array<{ id: string; name: string }>>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [vaultName, setVaultName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const baseItems = useMemo(() => ([
    { id: 'personal', name: t('vault.personal') as string, icon: 'user', color: 'bg-blue-500' },
    { id: 'work', name: t('vault.work') as string, icon: 'briefcase', color: 'bg-purple-500' },
  ]), [t])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!firebaseEnabled || !db || !user?.uid) return
      try {
        const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(user?.email) || 'default'
        const accountId = (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId')) || 'unknown'
        const region = (typeof localStorage !== 'undefined' && localStorage.getItem('awsRegion'))
        const colPath = `${tenant}/${accountId}/${region}/${user.uid}/_vaults`
        const snap = await getDocs(collection(db, colPath))
        if (!mounted) return
        const list: Array<{ id: string; name: string }> = []
        snap.forEach(d => {
          const data = d.data() as any
          list.push({ id: d.id, name: data?.name || d.id })
        })
        setCustomVaults(list)
      } catch {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [user?.uid, user?.email])

  async function createVaultByName(name: string): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) return
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)
    if (!slug) return
    setIsSaving(true)
    try {
      if (!firebaseEnabled || !db || !user?.uid) {
        dispatch(setSelectedVaultId(slug))
        setCustomVaults(prev => [...prev, { id: slug, name: trimmed }])
        setIsAddOpen(false)
        setVaultName('')
        return
      }
      const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(user?.email) || 'default'
      const accountId = (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId')) || 'unknown'
      const region = (typeof localStorage !== 'undefined' && localStorage.getItem('awsRegion')) || 'eu-west-1'
      const colPath = `${tenant}/${accountId}/${region}/${user.uid}/_vaults`
      await setDoc(doc(collection(db, colPath), slug), { name: trimmed })
      setCustomVaults(prev => [...prev.filter(v => v.id !== slug), { id: slug, name: trimmed }])
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
      {[...baseItems, ...customVaults].map((vault: any) => (
        <button 
          key={vault.id} 
          onClick={() => dispatch(setSelectedVaultId(vault.id))} 
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
      ))}
      
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


