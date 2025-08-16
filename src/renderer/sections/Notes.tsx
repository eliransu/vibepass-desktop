import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, useUpdateMutation, type VaultItem } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { setSelectedItemId, setSearchQuery } from '../features/ui/uiSlice'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

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
  const { data, isFetching } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const isSsoMissingOrExpired = !awsAccountId
  const [createItem] = useCreateMutation()
  const [updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()
  
  const notes = useMemo(() => (data ?? [])
    .filter(i => (i.category ?? 'notes') === 'notes')
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.notes ?? '').toLowerCase().includes(search.toLowerCase()))
  , [data, search])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingNote, setEditingNote] = useState<VaultItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  })
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
      content: ''
    })
    setShowCreateForm(false)
    setEditingNote(null)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uid || !key || !formData.title) return
    
    const item: VaultItem = { 
      id: editingNote?.id || '', 
      title: formData.title, 
      notes: formData.content, 
      category: 'notes' 
    }
    try {
      setIsSubmitting(true)
      if (editingNote) {
        const pr: any = updateItem({ uid, key, item: { ...item, id: editingNote.id }, selectedVaultId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      } else {
        const pr: any = createItem({ uid, key, item, selectedVaultId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      }
      resetForm()
    } catch (e: any) {
      const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
      if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
        alert((t('team.ssoExpiredInline') as string))
      } else {
        alert((t('team.createFailed') as string))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(note: VaultItem) {
    setFormData({
      title: note.title,
      content: note.notes || ''
    })
    setEditingNote(note)
    setShowCreateForm(true)
  }

  return (
    <div className="h-full flex" ref={containerRef}>
      {/* Items list */}
      <div className="bg-card border-r border-border flex flex-col" style={{ width: listWidth }}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.notes')}</h1>
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
            {!isFetching && notes.length === 0 && (
              <div className="py-10">
                <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
              </div>
            )}
            {!isFetching && notes.map((note) => (
              <button 
                key={note.id} 
                onClick={() => dispatch(setSelectedItemId(note.id))} 
                className={`
                  w-full text-left p-3 rounded-lg transition-all duration-200 group
                  ${selectedId === note.id 
                    ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                    : 'hover:bg-muted/50 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      selectedId === note.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate group-hover:text-foreground">
                      {note.title}
                    </div>
                    {note.notes && (
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {note.notes.split('\n')[0]}
                      </div>
                    )}
                  </div>
                  
                  {selectedId === note.id && (
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
                  {editingNote ? t('actions.editNote') : t('actions.addNote')}
                </h2>
                <Button variant="ghost" onClick={resetForm}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <form onSubmit={handleSubmit} className="h-full flex flex-col max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('fields.title') as string}
                    required
                  />
                </div>
                
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={t('fields.notes') as string}
                    className="flex-1 min-h-[300px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-none"
                  />
                </div>
                
                <div className="flex gap-3 pt-6">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {editingNote ? t('actions.update') : t('actions.create')}
                      </span>
                    ) : (
                      editingNote ? t('actions.update') : t('actions.create')
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
            const note = notes.find(x => x.id === selectedId)
            if (!note) return (
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{note.title}</h2>
                        <div className="text-sm text-muted-foreground">
                          {note.notes?.split(' ').length} {t('fields.words')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(note)}>
                        {t('actions.edit')}
                      </Button>
                      <Button 
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={async () => {
                          if (!uid || !key) return
                          try {
                            setIsDeleting(true)
                            await (removeItem({ uid, key, id: note.id, selectedVaultId }) as any).unwrap?.() ?? removeItem({ uid, key, id: note.id, selectedVaultId })
                            if (selectedId === note.id) {
                              dispatch(setSelectedItemId(null))
                            }
                          } catch (e: any) {
                            const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
                            if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
                              alert((t('team.ssoExpiredInline') as string))
                            } else {
                              alert((t('team.listFailed') as string))
                            }
                          } finally {
                            setIsDeleting(false)
                          }
                        }}
                      >
                        {isDeleting ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {t('actions.delete')}
                          </span>
                        ) : (
                          t('actions.delete')
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-4xl">
                    <div className="w-full px-4 py-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
                      {note.notes || t('vault.empty')}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    </div>
  )
}

export default function Notes(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


