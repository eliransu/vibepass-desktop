import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { useListQuery, type VaultItem } from '../../services/vaultApi'
import { setSelectedItemId, setSelectedVaultId, setSearchQuery } from '../../features/ui/uiSlice'
import { useNavigate } from 'react-router-dom'
import { Input } from './input'
import { Icon, PasswordIcon, ApiKeyIcon, NotesIcon, CardsIcon } from './icon'
import { dedupeTags } from '../../lib/tags'

type CommandPaletteProps = {
  onClose: () => void
}

export function CommandPalette({ onClose }: CommandPaletteProps): React.JSX.Element {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [q, setQ] = useState('')

  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)

  // Fetch data for search: in cloud mode, fetch both personal and work vaults; otherwise, current vault
  const { data: dataLocal, isFetching: isFetchingLocal } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId,
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode === 'cloud' })

  const { data: dataPersonal, isFetching: fetchingPersonal } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId: 'personal',
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode !== 'cloud' })

  const { data: dataWork, isFetching: fetchingWork } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId: 'work',
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode !== 'cloud' })

  useEffect(() => {
    // Autofocus when opened
    const id = window.setTimeout(() => { inputRef.current?.focus() }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  type SearchEntry = { item: VaultItem; vaultId: 'personal' | 'work' }

  const entries = useMemo((): SearchEntry[] => {
    if (storageMode === 'cloud') {
      const p = (dataPersonal ?? []).map((it) => ({ item: it, vaultId: 'personal' as const }))
      const w = (dataWork ?? []).map((it) => ({ item: it, vaultId: 'work' as const }))
      return [...p, ...w]
    }
    const base = (dataLocal ?? []).map((it) => ({ item: it, vaultId: selectedVaultId as 'personal' | 'work' }))
    return base
  }, [storageMode, dataPersonal, dataWork, dataLocal, selectedVaultId])

  const results = useMemo<SearchEntry[]>(() => {
    const query = (q || '').trim().toLowerCase()
    if (!query) return [] as SearchEntry[]
    const stripHash = query.replace(/^#/, '')
    return entries.filter(({ item: it }) => {
      const title = (it.title || '').toLowerCase()
      const username = (it.username || '').toLowerCase()
      const url = (it.url || '').toLowerCase()
      const notes = (it.notes || '').toLowerCase()
      const tags = (Array.isArray(it.tags) ? it.tags : []).map((t) => (t || '').toLowerCase().replace(/^#/, ''))
      const inTitle = title.includes(stripHash)
      const inUsername = username.includes(stripHash)
      const inUrl = url.includes(stripHash)
      const inNotes = notes.includes(stripHash)
      const inTags = tags.some((t) => t.includes(stripHash))
      return inTitle || inUsername || inUrl || inNotes || inTags
    }).slice(0, 200)
  }, [q, entries])

  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => { setActiveIdx(0) }, [q])

  const handleSelect = useCallback((entry: SearchEntry) => {
    const { item, vaultId } = entry
    const category = (item.category || 'passwords') as NonNullable<VaultItem['category']>
    const path = category === 'passwords' ? '/passwords'
      : category === 'api-keys' ? '/api-keys'
      : category === 'notes' ? '/notes'
      : category === 'cards' ? '/cards'
      : '/passwords'
    dispatch(setSelectedVaultId(vaultId))
    // Clear any existing list filter so the selected item is visible after navigation/fetch
    dispatch(setSearchQuery(''))
    // Set selection before navigation to avoid missing initial render on destination
    dispatch(setSelectedItemId(item.id))
    navigate(path, { state: { preloadedItem: item } })
    onClose()
  }, [dispatch, navigate, onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = results[activeIdx]
      if (entry) handleSelect(entry)
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-100 transition-opacity" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center pt-24 px-4">
        <div className="w-full max-w-2xl bg-card border-2 border-border rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 origin-top">
          <div className="p-3 border-b border-border relative">
            <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef as any}
              placeholder={"Search all categories: name, user, url, notes or #tag"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              className="pl-10 bg-background border-0 focus:bg-background h-12 text-base"
            />
          </div>
          <div className="max-h-80 overflow-auto p-2">
            {(storageMode === 'cloud' ? (fetchingPersonal || fetchingWork) : isFetchingLocal) && (
              <div className="py-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}
            {!(storageMode === 'cloud' ? (fetchingPersonal || fetchingWork) : isFetchingLocal) && q && results.length === 0 && (
              <div className="py-10 text-center text-muted-foreground text-sm">No results</div>
            )}
            {!(storageMode === 'cloud' ? (fetchingPersonal || fetchingWork) : isFetchingLocal) && results.map((entry, idx) => {
              const it = entry.item
              const category = (it.category || 'passwords')
              const tags = dedupeTags(it.tags || [])
              return (
                <button
                  key={`${entry.vaultId}:${it.id}`}
                  onClick={() => handleSelect(entry)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${idx === activeIdx ? 'bg-muted/70' : 'hover:bg-muted/50'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-muted flex-shrink-0`}>
                    {category === 'passwords' && <PasswordIcon size={14} />}
                    {category === 'api-keys' && <ApiKeyIcon size={14} />}
                    {category === 'notes' && <NotesIcon size={14} />}
                    {category === 'cards' && <CardsIcon size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground px-2 py-0.5 rounded-md border border-border capitalize">{category.replace('-', ' ')}</div>
                      <div className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-md border border-border uppercase">{entry.vaultId}</div>
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {tags.slice(0, 6).map((t) => (
                          <span key={t} className="text-[11px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">{t}</span>
                        ))}
                        {tags.length > 6 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">+{tags.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="p-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Esc</kbd>
              <span>Close</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Enter</kbd>
              <span>Open</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


