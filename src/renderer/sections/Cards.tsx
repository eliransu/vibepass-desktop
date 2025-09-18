import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, useUpdateMutation, type VaultItem } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
import { resolveVaultContext, getVaultSecretNameWithOverrides } from '../services/vaultPaths'
import { decryptJson } from '../../shared/security/crypto'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Icon } from '../components/ui/icon'
import { copyToClipboard } from '../lib/clipboard'

function Content(): React.JSX.Element {
  const location = useLocation() as any
  const routePreloaded: VaultItem | null = (location?.state?.preloadedItem as VaultItem) || null
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const selectedId = useSelector((s: RootState) => s.ui.selectedItemId)
  const search = useSelector((s: RootState) => s.ui.searchQuery)
  const uid = user?.uid ?? ''
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsProfile = undefined
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const ssoRequired = useSelector((s: RootState) => s.ui.ssoRequired)
  const isSsoMissingOrExpired = storageMode === 'cloud' && (!!ssoRequired || !awsAccountId)
  const [createItem] = useCreateMutation()
  const [updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()
  
  const cards = useMemo(() => (data ?? [])
    .filter(i => (i.category ?? 'cards') === 'cards')
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.username ?? '').toLowerCase().includes(search.toLowerCase()))
  , [data, search])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCard, setEditingCard] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null}>({isOpen: false, item: null})
  const [formData, setFormData] = useState({
    title: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [resolvedItem, setResolvedItem] = useState<VaultItem | null>(null)

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

  function formatCardNumber(value: string): string {
    const digitsOnly = (value || '').replace(/\D/g, '').slice(0, 19)
    return (digitsOnly.match(/.{1,4}/g) || []).join('-')
  }

  // Fallback: direct read from consolidated vault in cloud mode to resolve selected card
  useEffect(() => {
    let cancelled = false
    async function loadDirectFromVault(): Promise<void> {
      try {
        if (!selectedId || storageMode !== 'cloud' || !uid || !key) return
        if (!awsRegion || !awsAccountId) return
        if (cards.find(x => x.id === selectedId)) return
        const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email: user?.email, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, email: user?.email, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        const res = await (window as any).cloudpass?.vaultRead?.(awsRegion || region, name, profile)
        if (cancelled) return
        if (!res || res.success !== true) return
        const secret = res.data
        let parsed: Record<string, VaultItem> = {}
        try {
          parsed = selectedVaultId === 'work' ? (JSON.parse(secret) as Record<string, VaultItem>) : decryptJson<Record<string, VaultItem>>(secret, key)
        } catch {
          try { parsed = JSON.parse(secret) as Record<string, VaultItem> } catch { parsed = {} }
        }
        const found = parsed[selectedId]
        if (found) setResolvedItem({ ...found })
      } catch {}
    }
    void loadDirectFromVault()
    return () => { cancelled = true }
  }, [selectedId, storageMode, uid, key, selectedVaultId, user?.email, awsRegion, awsAccountId, cards])
  function unformatCardNumber(value: string): string {
    return (value || '').replace(/\D/g, '').slice(0, 19)
  }

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
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
      notes: ''
    })
    setShowCreateForm(false)
    setEditingCard(null)
  }

  // Reset local UI state when storage mode changes
  useEffect(() => {
    try {
      setShowCreateForm(false)
      setEditingCard(null)
      setFormData({
        title: '',
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: '',
        notes: ''
      })
      dispatch(setSelectedItemId(null))
      dispatch(setSearchQuery(''))
    } catch {}
  }, [storageMode, dispatch])

  // When selection changes via command palette, mimic list item click side-effects
  useEffect(() => {
    if (!selectedId) return
    try {
      setShowCreateForm(false)
      setEditingCard(null)
    } catch {}
  }, [selectedId])

  // Ensure selection is set from route preloaded item immediately upon navigation
  useEffect(() => {
    if (routePreloaded && routePreloaded.id && selectedId !== routePreloaded.id) {
      try { dispatch(setSelectedItemId(routePreloaded.id)) } catch {}
    }
  }, [routePreloaded, routePreloaded?.id, selectedId, dispatch])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uid || !key || !formData.title) return
    
    const cardData = {
      number: unformatCardNumber(formData.cardNumber),
      expiry: formData.expiryDate,
      cvv: formData.cvv,
      cardholder: formData.cardholderName
    }
    
    const item: VaultItem = { 
      id: editingCard?.id || '', 
      title: formData.title, 
      notes: JSON.stringify(cardData), 
      category: 'cards' 
    }
    try {
      setIsSubmitting(true)
      if (editingCard) {
        const pr: any = updateItem({ uid, key, item: { ...item, id: editingCard.id }, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
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
        alert((t('team.ssoExpiredInline') as string))
      } else {
        alert((t('team.createFailed') as string))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(card: VaultItem) {
    try {
      const cardData = JSON.parse(card.notes || '{}')
      setFormData({
        title: card.title,
        cardNumber: formatCardNumber(cardData.number || ''),
        expiryDate: cardData.expiry || '',
        cvv: cardData.cvv || '',
        cardholderName: cardData.cardholder || '',
        notes: ''
      })
      setEditingCard(card)
      setShowCreateForm(true)
    } catch {
      setFormData({
        title: card.title,
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: '',
        notes: card.notes || ''
      })
      setEditingCard(card)
      setShowCreateForm(true)
    }
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
          alert((t('team.ssoExpiredInline') as string))
        } else {
          alert((t('team.listFailed') as string))
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
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.cards')}</h1>
            <button 
              className="h-9 w-9 bg-primary hover:bg-primary-hover rounded-lg flex items-center justify-center transition-colors"
              title={t('actions.add')}
              onClick={() => setShowCreateForm(true)}
            >
              <Icon name="plus" size={16} className="text-primary-foreground" />
            </button>
          </div>
          
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
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
            {!isFetching && cards.length === 0 && (
              <div className="py-10">
                <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
              </div>
            )}
            {!isFetching && cards.map((card) => {
              let cardData = { number: '', cardholder: '' }
              try {
                cardData = JSON.parse(card.notes || '{}')
              } catch {
                // Fallback for old format
              }
              
              return (
                <button 
                  key={card.id} 
                  onClick={() => { try { setShowCreateForm(false); setEditingCard(null); setFormData({ title: '', cardNumber: '', expiryDate: '', cvv: '', cardholderName: '', notes: '' }) } catch {}; dispatch(setSelectedItemId(card.id)) }} 
                  className={`
                    w-full text-left p-3 rounded-lg transition-all duration-200 group
                    ${selectedId === card.id 
                      ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                      : 'hover:bg-muted/50 border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        selectedId === card.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Icon name="credit-card" size={16} />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate group-hover:text-foreground">
                        {card.title}
                      </div>
                      {cardData.cardholder && (
                        <div className="text-sm text-muted-foreground truncate">
                          {cardData.cardholder}
                        </div>
                      )}
                      {cardData.number && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          •••• {cardData.number.slice(-4)}
                        </div>
                      )}
                    </div>
                    
                    {selectedId === card.id && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                </button>
              )
            })}
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
      <div className="flex-1 bg-background min-w-0">
        {showCreateForm ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingCard ? t('actions.editCard') : t('actions.addCard')}
                </h2>
                <Button variant="ghost" onClick={resetForm}>
                    <Icon name="x" size={16} />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')} <span className="text-destructive">*</span></label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={t('fields.title') as string}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.cardholderName')}</label>
                    <Input
                      value={formData.cardholderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, cardholderName: e.target.value }))}
                      placeholder={t('fields.cardholderName') as string}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.cardNumber')}</label>
                    <Input
                      value={formData.cardNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                      placeholder="1234-5678-9012-3456"
                      type="text"
                      inputMode="numeric"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.expiryDate')}</label>
                    <Input
                      value={formData.expiryDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      placeholder="MM/YY"
                      type="text"
                    />
                  </div>
                  
                  <div>
                    <label className="block text sm font-medium text-foreground mb-2">{t('fields.cvv')}</label>
                    <Input
                      value={formData.cvv}
                      onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value }))}
                      placeholder="123"
                      type="text"
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3 pt-6">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {editingCard ? t('actions.update') : t('actions.create')}
                      </span>
                    ) : (
                      editingCard ? t('actions.update') : t('actions.create')
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
            const card = (routePreloaded && routePreloaded.id === selectedId) ? routePreloaded : (resolvedItem ?? cards.find(x => x.id === selectedId))
            if (!card) return (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground">{t('vault.empty')}</div>
                </div>
              </div>
            )
            
            let cardData = { number: '', expiry: '', cvv: '', cardholder: '' }
            try {
              cardData = JSON.parse(card.notes || '{}')
            } catch {
              // Fallback for old format
            }
            
            return (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                        <Icon name="credit-card" size={24} className="text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{card.title}</h2>
                        {cardData.cardholder && (
                          <div className="text-sm text-muted-foreground">{cardData.cardholder}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="secondary" onClick={() => startEdit(card)}>
                        {t('actions.edit')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDeleteClick(card)}
                      >
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-2xl space-y-6">
                    {cardData.number && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('fields.cardNumber')}</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-12 px-4 bg-muted/50 rounded-lg flex items-center font-mono text-sm">
                            <>•••• •••• •••• {cardData.number.slice(-4)}</>
                          </div>
                          <button 
                            className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${cardData.number ? 'bg-primary hover:bg-primary-hover' : 'bg-muted cursor-not-allowed'}`}
                            onClick={() => cardData.number && copyToClipboard(cardData.number)}
                            disabled={!cardData.number}
                            title={t('actions.copy')}
                          >
                            <Icon name="copy" size={16} className={`${cardData.number ? 'text-primary-foreground' : 'text-muted-foreground'}`} /> 
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expiry and CVV */}
                    <div className="grid grid-cols-2 gap-4">
                      {cardData.expiry && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">{t('fields.expiryDate')}</label>
                          <div className="h-12 px-4 bg-muted/50 rounded-lg flex items-center text-sm">
                            {cardData.expiry}
                          </div>
                        </div>
                      )}
                      
                      {cardData.cvv && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">{t('fields.cvv')}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-12 px-4 bg-muted/50 rounded-lg flex items-center font-mono text-sm">
                              {'•••'}
                            </div>
                            <button 
                              className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${cardData.cvv ? 'bg-muted hover:bg-muted/80' : 'bg-muted cursor-not-allowed'}`}
                              onClick={() => copyToClipboard(cardData.cvv)}
                              title={t('actions.copy')}
                            >
                              <Icon name="copy" size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Notes intentionally hidden in view mode per request */}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="credit-card" size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('search.select')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('vault.selectDescription')}
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">{navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}</kbd>
                +<kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">K</kbd> to search any card by name or #tag.
              </div>
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

export function Cards(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


