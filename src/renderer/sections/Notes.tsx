import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, useUpdateMutation, type VaultItem } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import { useTranslation } from 'react-i18next'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { marked } from 'marked'
import { Icon } from '../components/ui/icon'
import DOMPurify from 'dompurify'
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
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const isSsoMissingOrExpired = storageMode === 'cloud' && !awsAccountId
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
  const [preview, setPreview] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('listPaneWidth')) || ''
    const parsed = parseInt(saved, 10)
    return Number.isFinite(parsed) && parsed >= 240 && parsed <= 600 ? parsed : 320
  })
  const [isResizing, setIsResizing] = useState(false)

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
      content: ''
    })
    setShowCreateForm(false)
    setEditingNote(null)
  }

  // Reset local UI state when storage mode changes
  useEffect(() => {
    try {
      setShowCreateForm(false)
      setEditingNote(null)
      setFormData({ title: '', content: '' })
      setPreview(false)
      dispatch(setSelectedItemId(null))
      dispatch(setSearchQuery(''))
    } catch {}
  }, [storageMode, dispatch])

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
        const pr: any = updateItem({ uid, key, item: { ...item, id: editingNote.id }, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
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

  function startEdit(note: VaultItem) {
    setFormData({
      title: note.title,
      content: note.notes || ''
    })
    setEditingNote(note)
    setShowCreateForm(true)
  }

  return (
    <div className="h-full min-h-0 flex" ref={containerRef}>
      {/* Items list */}
      <div className="bg-card border-r border-border flex flex-col min-h-0" style={{ width: listWidth }}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.notes')}</h1>
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
            {!isFetching && notes.length === 0 && (
              <div className="py-10">
                <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
              </div>
            )}
            {!isFetching && notes.map((note) => (
              <button 
                key={note.id} 
                onClick={() => { try { setShowCreateForm(false); setEditingNote(null); setFormData({ title: '', content: '' }); setPreview(false) } catch {}; dispatch(setSelectedItemId(note.id)) }} 
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
                      <Icon name="file-text" size={16} />
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
      <div className="flex-1 bg-background min-w-0">
        {showCreateForm ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingNote ? t('actions.editNote') : t('actions.addNote')}
                </h2>
                <Button variant="ghost" onClick={resetForm}>
                  <Icon name="x" size={16} />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <form onSubmit={handleSubmit} className="h-full flex flex-col max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')} <span className="text-destructive">*</span></label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('fields.title') as string}
                    required
                  />
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" variant={preview ? 'secondary' : 'default'} onClick={() => setPreview(false)}>{t('actions.edit')}</Button>
                  <Button type="button" variant={preview ? 'default' : 'secondary'} onClick={() => setPreview(true)}>Preview</Button>
                </div>

                {!preview ? (
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder={t('fields.notes') as string}
                      className="flex-1 min-h-[300px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-none"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-2">Preview</label>
                    <div
                      className="prose prose-invert max-w-none bg-muted/30 rounded-lg p-4 border border-border text-sm"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(formData.content || '') as string) }}
                    />
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3 pt-6">
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
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                          <Icon name="file-text" size={16} className="text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{note.title}</h2>
                        <div className="text-sm text-muted-foreground">
                          {note.notes?.split(' ').length} {t('fields.words')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
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
                            await (removeItem({ uid, key, id: note.id, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }) as any).unwrap?.() ?? removeItem({ uid, key, id: note.id, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
                            if (selectedId === note.id) {
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
                    {note.notes && (
                      <div className="w-full p-4 bg-muted/50 rounded-lg text-sm leading-relaxed border border-border">
                        <div
                          className="prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(note.notes || '') as string) }}
                        />
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
                <Icon name="file-text" size={16} className="text-muted-foreground" />
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


