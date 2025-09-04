import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, useUpdateMutation, type VaultItem } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { decryptJson } from '../../shared/security/crypto'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
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
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const isSsoMissingOrExpired = !awsAccountId
  const [createItem] = useCreateMutation()
  const [updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()

  const items = useMemo(() => (data ?? [])
    .filter(i => i.category === 'api-keys')
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.notes ?? '').toLowerCase().includes(search.toLowerCase()))
  , [data, search])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null}>({isOpen: false, item: null})
  const [formData, setFormData] = useState({
    title: '',
    secret: '',
    details: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSecret, _setShowSecret] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const clearAwsAccountContext = useCallback(() => {
    try { localStorage.removeItem('awsAccountId') } catch {}
    try { void (window as any).cloudpass?.storeSet?.('awsAccountId', '') } catch {}
    try { dispatch(setAwsAccountId('')) } catch {}
  }, [dispatch])

  useEffect(() => {
    if (!error) return
    const msg = String((error as any)?.error ?? (error as any)?.data?.error ?? (error as any)?.message ?? '')
    if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
      clearAwsAccountContext()
    }
  }, [error, clearAwsAccountContext])

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
      if ((window as any).cloudpass?.storeSet) {
        void (window as any).cloudpass.storeSet('listPaneWidth', String(listWidth))
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
      secret: '',
      details: ''
    })
    setShowCreateForm(false)
    setEditingItem(null)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uid || !key || !formData.title) return

    const item: VaultItem = {
      id: editingItem?.id || '',
      title: formData.title,
      password: formData.secret,
      notes: formData.details,
      category: 'api-keys'
    }
    try {
      setIsSubmitting(true)
      if (editingItem) {
        const pr: any = updateItem({ uid, key, item: { ...item, id: editingItem.id }, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      } else {
        const pr: any = createItem({ uid, key, item, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      }
      resetForm()
    } catch (e: any) {
      const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
      if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
        clearAwsAccountContext()
        showToast(t('team.ssoExpiredInline') as string, 'error')
      } else {
        showToast(t('team.createFailed') as string, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(v: VaultItem) {
    setFormData({
      title: v.title,
      secret: v.password || '',
      details: v.notes || ''
    })
    setEditingItem(v)
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
          const pr: any = removeItem({ uid, key, id: deleteConfirm.item.id, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
          await (pr?.unwrap ? pr.unwrap() : pr)
        }
        setDeleteConfirm({isOpen: false, item: null})
        if (selectedId === deleteConfirm.item.id) {
          dispatch(setSelectedItemId(null))
        }
      } catch (e: any) {
        const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
        if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
          clearAwsAccountContext()
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
    <div className="h-full min-h-0 flex" ref={containerRef}>
      {/* Items list */}
      <div className="bg-card border-r border-border flex flex-col min-h-0" style={{ width: listWidth }}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.apiKeys')}</h1>
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
            {!isFetching && items.length === 0 && (
              <div className="py-10">
                <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
              </div>
            )}
            {!isFetching && items.map((it) => (
              <button 
                key={it.id} 
                onClick={() => dispatch(setSelectedItemId(it.id))} 
                className={`
                  w-full text-left p-3 rounded-lg transition-all duration-200 group
                  ${selectedId === it.id 
                    ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                    : 'hover:bg-muted/50 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      selectedId === it.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <svg className="w-[10.35px] h-[10.35px]" viewBox="0 0 18 18" fill="currentColor">
                        <path d="M17.408 3.412a1.974 1.974 0 0 0 0-2.82 1.973 1.973 0 0 0-2.819 0l-.29.29-.59-.59a1.009 1.009 0 0 0-1.65.35l-.35-.35a1.004 1.004 0 1 0-1.42 1.42l.35.35a1.033 1.033 0 0 0-.58.58l-.35-.35a1.004 1.004 0 0 0-1.42 1.42L9.879 5.3l-3.02 3.01c-.01.01-.02.03-.03.04A4.885 4.885 0 0 0 5 8a5 5 0 1 0 5 5 4.885 4.885 0 0 0-.35-1.83c.01-.01.03-.02.04-.03l7.718-7.728zM5 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" fillRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate group-hover:text-foreground">
                      {it.title}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {(it.notes || '').split('\n')[0]}
                    </div>
                  </div>
                  
                  {selectedId === it.id && (
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
                  {editingItem ? t('actions.editApiKey') : t('actions.addApiKey')}
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
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.secret')}</label>
                    <Input
                      value={formData.secret}
                      onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                      placeholder={t('fields.secret') as string}
                      type={showSecret ? 'text' : 'password'}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.details')}</label>
                    <textarea
                      value={formData.details}
                      onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
                      placeholder={t('fields.details') as string}
                      className="w-full min-h-[100px] px-3 py-2 bg-background border border-input rounded-lg text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent transition-all duration-200 resize-vertical"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-6">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {editingItem ? t('actions.update') : t('actions.create')}
                      </span>
                    ) : (
                      editingItem ? t('actions.update') : t('actions.create')
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
            const it = items.find(x => x.id === selectedId)
            if (!it) return (
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
                        <svg className="w-[10.35px] h-[10.35px] text-primary-foreground" viewBox="0 0 18 18" fill="currentColor">
                          <path d="M17.408 3.412a1.974 1.974 0 0 0 0-2.82 1.973 1.973 0 0 0-2.819 0l-.29.29-.59-.59a1.009 1.009 0 0 0-1.65.35l-.35-.35a1.004 1.004 0 1 0-1.42 1.42l.35.35a1.033 1.033 0 0 0-.58.58l-.35-.35a1.004 1.004 0 0 0-1.42 1.42L9.879 5.3l-3.02 3.01c-.01.01-.02.03-.03.04A4.885 4.885 0 0 0 5 8a5 5 0 1 0 5 5 4.885 4.885 0 0 0-.35-1.83c.01-.01.03-.02.04-.03l7.718-7.728zM5 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" fillRule="evenodd"/>
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{it.title}</h2>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(it)}>
                        {t('actions.edit')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDeleteClick(it)}
                      >
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content (read-only form layout) */}
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
                      <div className="h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{it.title}</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.secret')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center font-mono text-sm">{'•'.repeat(12)}</div>
                        <button 
                          className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground"
                          onClick={async () => {
                            if (!it.ssmArn) {
                              await copyWithFeedback(it.password ?? '', t('clipboard.secretCopied') || t('clipboard.passwordCopied'), showToast)
                              return
                            }
                            try {
                              const { resolveVaultContext } = await import('../services/vaultPaths')
                              const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion })
                              const secret = await window.cloudpass.teamGetSecretValue(awsRegion || region, it.ssmArn, awsProfile || profile)
                              if (secret) {
                                const decrypted = decryptJson<VaultItem>(secret, key ?? '')
                                await copyWithFeedback(decrypted.password ?? '', t('clipboard.secretCopied') || t('clipboard.passwordCopied'), showToast)
                              }
                            } catch {
                              await copyWithFeedback(it.password ?? '', t('clipboard.secretCopied') || t('clipboard.passwordCopied'), showToast)
                            }
                          }}
                          title={t('actions.copy')}
                        >
                          {t('actions.copy')}
                        </button>
                      </div>
                    </div>

                    {it.notes && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">{t('fields.details')}</label>
                        <div className="w-full px-3 py-2 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">{it.notes}</div>
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
                <svg className="w-[20.7px] h-[20.7px] text-muted-foreground" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M17.408 3.412a1.974 1.974 0 0 0 0-2.82 1.973 1.973 0 0 0-2.819 0l-.29.29-.59-.59a1.009 1.009 0 0 0-1.65.35l-.35-.35a1.004 1.004 0 1 0-1.42 1.42l.35.35a1.033 1.033 0 0 0-.58.58l-.35-.35a1.004 1.004 0 0 0-1.42 1.42L9.879 5.3l-3.02 3.01c-.01.01-.02.03-.03.04A4.885 4.885 0 0 0 5 8a5 5 0 1 0 5 5 4.885 4.885 0 0 0-.35-1.83c.01-.01.03-.02.04-.03l7.718-7.728zM5 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" fillRule="evenodd"/>
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

export default function ApiKeys(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}
