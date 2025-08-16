import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, type VaultItem } from '../services/vaultApi'
import { useUpdateMutation } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { decryptJson } from '../../shared/security/crypto'
import { setSelectedItemId, setSearchQuery } from '../features/ui/uiSlice'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { copyWithFeedback } from '../lib/clipboard'
import { useSafeToast } from '../hooks/useSafeToast'

function Content(): React.JSX.Element {
  const { t } = useTranslation()
  const { showToast } = useSafeToast()
  const dispatch = useDispatch()
  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedId = useSelector((s: RootState) => s.ui.selectedItemId)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const search = useSelector((s: RootState) => s.ui.searchQuery)
  const uid = user?.uid ?? ''
  const email = user?.email ?? ''
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsProfile = useSelector((s: RootState) => s.ui.awsProfile)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const { data, isFetching } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const isSsoMissingOrExpired = !awsAccountId
  const [_createItem] = useCreateMutation()
  const [_updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()

  const passwords = useMemo(() => (data ?? [])
    .filter(i => (i.category ?? 'passwords') === 'passwords')
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.username ?? '').toLowerCase().includes(search.toLowerCase()))
  , [data, search])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPassword, setEditingPassword] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null}>({isOpen: false, item: null})
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('listPaneWidth')) || ''
    const parsed = parseInt(saved, 10)
    return Number.isFinite(parsed) && parsed >= 240 && parsed <= 600 ? parsed : 320
  })
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return
    const onMove = (e: MouseEvent) => {
      const left = containerRef.current?.getBoundingClientRect().left ?? 0
      const raw = e.clientX - left
      const clamped = Math.max(240, Math.min(600, raw))
      setListWidth(clamped)
    }
    const onUp = () => {
      setIsResizing(false)
      localStorage.setItem('listPaneWidth', String(listWidth))
      if ((window as any).vibepass?.storeSet) {
        void (window as any).vibepass.storeSet('listPaneWidth', String(listWidth))
      }
      document.body.style.cursor = ''
      ;(document.body.style as any).userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    ;(document.body.style as any).userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      ;(document.body.style as any).userSelect = ''
    }
  }, [isResizing, listWidth])

  function resetForm() {
    setFormData({
      title: '',
      username: '',
      password: '',
      url: '',
      notes: ''
    })
    setShowCreateForm(false)
    setEditingPassword(null)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uid || !key || !formData.title) return
    
    const item: VaultItem = { 
      id: editingPassword?.id || '', 
      title: formData.title, 
      username: formData.username,
      password: formData.password,
      url: formData.url,
      notes: formData.notes,
      category: 'passwords' 
    }
    try {
      setIsSubmitting(true)
      if (editingPassword) {
        const pr: any = _updateItem({ uid, key, item: { ...item, id: editingPassword.id }, selectedVaultId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      } else {
        const pr: any = _createItem({ uid, key, item, selectedVaultId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      }
      resetForm()
    } catch (e: any) {
      const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
      if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
        showToast(t('team.ssoExpiredInline') as string, 'error')
      } else {
        showToast(t('team.createFailed') as string, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(password: VaultItem) {
    setFormData({
      title: password.title,
      username: password.username || '',
      password: password.password || '',
      url: password.url || '',
      notes: password.notes || ''
    })
    setEditingPassword(password)
    setShowCreateForm(true)
  }

  function handleDeleteClick(item: VaultItem) {
    setDeleteConfirm({isOpen: true, item})
  }

  async function handleDeleteConfirm() {
    if (deleteConfirm.item && uid && key) {
      try {
        setIsDeleting(true)
        {
          const pr: any = removeItem({ uid, key, id: deleteConfirm.item.id, selectedVaultId })
          await (pr?.unwrap ? pr.unwrap() : pr)
        }
        setDeleteConfirm({isOpen: false, item: null})
        if (selectedId === deleteConfirm.item.id) {
          dispatch(setSelectedItemId(null))
        }
      } catch (e: any) {
        const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
        if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
          showToast(t('team.ssoExpiredInline') as string, 'error')
        } else {
          showToast(t('team.listFailed') as string, 'error')
        }
      } finally {
        setIsDeleting(false)
      }
    }
  }



  return (
    <div className="h-full flex" ref={containerRef}>
      {/* Items list */}
      <div className="bg-card border-r border-border flex flex-col" style={{ width: listWidth }}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.passwords')}</h1>
            <button 
              className="h-9 w-9 bg-primary hover:bg-primary-hover rounded-lg flex items-center justify-center transition-colors"
              title={t('actions.add')}
              onClick={() => setShowCreateForm(true)}
            >
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input 
              placeholder={t('search.placeholder') as string} 
              value={search} 
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              className="pl-10 bg-muted/50 border-0 focus:bg-background"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-auto p-3">
          <div className="space-y-1">
            {isFetching && (
              <div className="py-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}
            {!isFetching && passwords.length === 0 && (
              <div className="py-10">
                <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
              </div>
            )}
            {!isFetching && passwords.map((p) => (
              <button 
                key={p.id} 
                onClick={() => dispatch(setSelectedItemId(p.id))} 
                className={`
                  w-full text-left p-3 rounded-lg transition-all duration-200 group
                  ${selectedId === p.id 
                    ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                    : 'hover:bg-muted/50 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      selectedId === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243A6 6 0 0121 9z" />
                      </svg>
                    </div>
                    {p.favorite && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-warning rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-warning-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate group-hover:text-foreground">
                      {p.title}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {p.username}
                    </div>
                    {p.url && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {new URL(p.url).hostname}
                      </div>
                    )}
                  </div>
                  
                  {selectedId === p.id && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => setIsResizing(true)}
        className={`w-1 cursor-col-resize bg-transparent hover:bg-border active:bg-border`} 
      />

      {/* Details panel */}
      <div className="flex-1 bg-background">
        {showCreateForm ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingPassword ? t('actions.editPassword') : t('actions.addPassword')}
                </h2>
                <Button variant="ghost" onClick={resetForm}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={t('fields.title') as string}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.username')}</label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder={t('fields.username') as string}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.password')}</label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder={t('fields.password') as string}
                        type="password"
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => {
                          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
                          const password = Array.from({length: 16}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
                          setFormData(prev => ({ ...prev, password }))
                        }}
                        title={t('actions.generatePassword')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.url')}</label>
                    <Input
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder={t('fields.notes') as string}
                      className="w-full min-h-[100px] px-3 py-2 bg-background border border-input rounded-lg text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent transition-all duration-200 resize-vertical"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-6">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {editingPassword ? t('actions.update') : t('actions.create')}
                      </span>
                    ) : (
                      editingPassword ? t('actions.update') : t('actions.create')
                    )}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>
                    {t('actions.cancel')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : selectedId ? (
          (() => {
            const p = passwords.find(x => x.id === selectedId)
            if (!p) return (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground">{t('vault.empty')}</div>
                </div>
              </div>
            )
            
            return (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243A6 6 0 0121 9z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{p.title}</h2>
                        <div className="text-sm text-muted-foreground">{p.username}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(p)}>
                        {t('actions.edit')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDeleteClick(p)}
                      >
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </div>
                  
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      {p.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content (read-only form layout) */}
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
                      <div className="h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{p.title}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.username')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{p.username || ''}</div>
                        <button 
                          className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                          onClick={() => copyWithFeedback(p.username ?? '', t('clipboard.usernameCopied'), showToast)}
                          title={t('actions.copy')}
                        >
                          {t('actions.copy')}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.password')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center font-mono text-sm">{'•'.repeat(12)}</div>
                        <button 
                          className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground"
                          onClick={async () => {
                            if (!p.ssmArn) {
                              await copyWithFeedback(p.password ?? '', t('clipboard.passwordCopied'), showToast)
                              return
                            }
                            try {
                              const { resolveVaultContext } = await import('../services/vaultPaths')
                              const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion })
                              const secret = await window.vibepass.teamGetSecretValue(awsRegion || region, p.ssmArn, awsProfile || profile)
                              if (secret) {
                                const decrypted = decryptJson<VaultItem>(secret, key ?? '')
                                await copyWithFeedback(decrypted.password ?? '', t('clipboard.passwordCopied'), showToast)
                              }
                            } catch {
                              await copyWithFeedback(p.password ?? '', t('clipboard.passwordCopied'), showToast)
                            }
                          }}
                          title={t('actions.copy')}
                        >
                          {t('actions.copy')}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.url')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm truncate">{p.url || ''}</div>
                        {!!p.url && (
                          <button 
                            className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                            onClick={() => window.open(p.url!, '_blank')}
                            title="Open"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                    {p.notes && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
                        <div className="w-full px-3 py-2 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">{p.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243A6 6 0 0121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('search.select')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('vault.selectDescription')}
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({isOpen: false, item: null})}
        onConfirm={handleDeleteConfirm}
        title={t('actions.confirmDelete')}
        message={t('actions.deleteMessage', { name: deleteConfirm.item?.title })}
        confirmText={t('actions.delete')}
        cancelText={t('actions.cancel')}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  )
}

export default function Passwords(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


