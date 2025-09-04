import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, useUpdateMutation, type VaultItem } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { copyToClipboard } from '../lib/clipboard'

function Content(): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const selectedId = useSelector((s: RootState) => s.ui.selectedItemId)
  const search = useSelector((s: RootState) => s.ui.searchQuery)
  const uid = user?.uid ?? ''
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsProfile = useSelector((s: RootState) => s.ui.awsProfile)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const isSsoMissingOrExpired = !awsAccountId
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.cards')}</h1>
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
                  onClick={() => dispatch(setSelectedItemId(card.id))} 
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
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
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
      <div className="flex-1 bg-background">
        {showCreateForm ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingCard ? t('actions.editCard') : t('actions.addCard')}
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
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.cvv')}</label>
                    <Input
                      value={formData.cvv}
                      onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value }))}
                      placeholder="123"
                      type="text"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-6">
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
            const card = cards.find(x => x.id === selectedId)
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{card.title}</h2>
                        {cardData.cardholder && (
                          <div className="text-sm text-muted-foreground">{cardData.cardholder}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
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
                    {/* Card Number - always show */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{t('fields.cardNumber')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-12 px-4 bg-muted/50 rounded-lg flex items-center font-mono text-sm">
                          {cardData.number ? (
                            <>•••• •••• •••• {cardData.number.slice(-4)}</>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <button 
                          className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${cardData.number ? 'bg-primary hover:bg-primary-hover' : 'bg-muted cursor-not-allowed'}`}
                          onClick={() => cardData.number && copyToClipboard(cardData.number)}
                          disabled={!cardData.number}
                          title={t('actions.copy')}
                        >
                          <svg className={`w-4 h-4 ${cardData.number ? 'text-primary-foreground' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expiry and CVV */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('fields.expiryDate')}</label>
                        <div className="h-12 px-4 bg-muted/50 rounded-lg flex items-center text-sm">
                          {cardData.expiry || <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('fields.cvv')}</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-12 px-4 bg-muted/50 rounded-lg flex items-center font-mono text-sm">
                            {cardData.cvv ? '•••' : <span className="text-muted-foreground">—</span>}
                          </div>
                          <button 
                            className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${cardData.cvv ? 'bg-muted hover:bg-muted/80' : 'bg-muted cursor-not-allowed'}`}
                            onClick={() => cardData.cvv && copyToClipboard(cardData.cvv)}
                            disabled={!cardData.cvv}
                            title={t('actions.copy')}
                          >
                            <svg className={`w-4 h-4 ${cardData.cvv ? '' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

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
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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

export default function Cards(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


