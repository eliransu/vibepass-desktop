import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Icon, PasswordIcon, ApiKeyIcon, NotesIcon, CardsIcon } from '../ui/icon'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { generateTotp, parseOtpMetaFromItem } from '../../lib/otp'
import { TrayAuthGate } from './TrayAuthGate'

/**
 * Tray search item structure
 */
type SearchItem = {
  id: string
  title: string
  username?: string
  url?: string
  category: 'passwords' | 'api-keys' | 'notes' | 'cards'
  vaultId: 'personal' | 'work'
  tags?: string[]
}

/**
 * Item detail structure with full data
 */
type ItemDetail = SearchItem & {
  password?: string
  notes?: string
}

/**
 * Quick search component for system tray
 * Lightweight search interface accessible via global shortcut
 */
export function TraySearch(): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [masterKey, setMasterKey] = useState<string>('')
  const [vaultSource, setVaultSource] = useState<'local' | 'cloud'>('local')

  const handleAuthenticated = (key: string) => {
    setMasterKey(key)
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <TrayAuthGate onAuthenticated={handleAuthenticated} />
  }

  return <TraySearchContent masterKey={masterKey} vaultSource={vaultSource} onVaultSourceChange={setVaultSource} />
}

function TraySearchContent({ masterKey: _masterKey, vaultSource, onVaultSourceChange }: { masterKey: string; vaultSource: 'local' | 'cloud'; onVaultSourceChange: (v: 'local' | 'cloud') => void }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [allItems, setAllItems] = useState<SearchItem[]>([])
  const [results, setResults] = useState<SearchItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [otpCode, setOtpCode] = useState<string | null>(null)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState<number>(0)
  const otpTimerRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => window.clearTimeout(timer)
  }, [onVaultSourceChange])

  // Focus detail view when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const timer = window.setTimeout(() => {
        const detailView = document.querySelector('[data-detail-view]') as HTMLElement
        if (detailView) {
          detailView.focus()
        }
      }, 100)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [selectedItem])

  // Load all items on mount and when vaultSource changes
  useEffect(() => {
    async function loadAllItems() {
      setIsLoading(true)
      try {
        const response = await window.cloudpass.traySearchGetData()
        
        if (response.success) {
          const items = response.data as SearchItem[]
          const filtered = items.filter((i) => i.vaultId === (vaultSource === 'cloud' ? 'work' : 'personal'))
          setAllItems(filtered)
          setResults(filtered.slice(0, 100)) // Show first 100 items initially
        }
      } catch {
        // Failed to load items
      } finally {
        setIsLoading(false)
      }
    }
    void loadAllItems()
  }, [vaultSource])

  // Persist vault source preference and hydrate on mount
  useEffect(() => {
    async function hydrate() {
      try {
        const pref = await window.cloudpass.storeGet<'local' | 'cloud'>('trayVaultSource')
        if (pref === 'local' || pref === 'cloud') onVaultSourceChange(pref)
      } catch {}
    }
    void hydrate()
  }, [onVaultSourceChange])

  useEffect(() => {
    void window.cloudpass.storeSet('trayVaultSource', vaultSource)
  }, [vaultSource])

  // Start OTP timer for selected item
  useEffect(() => {
    if (!selectedItem) return
    const meta = parseOtpMetaFromItem(selectedItem as any)
    if (!meta || !meta.secret) {
      if (otpTimerRef.current) { window.clearInterval(otpTimerRef.current); otpTimerRef.current = null }
      setOtpCode(null)
      setOtpSecondsLeft(0)
      return
    }
    const compute = () => {
      const now = Date.now()
      const code = generateTotp(meta.secret, { digits: meta.digits || 6, algorithm: meta.algorithm || 'SHA1', step: meta.step || 30, epoch: now })
      const elapsed = Math.floor((now / 1000) % (meta.step || 30))
      const left = Math.max(0, (meta.step || 30) - elapsed)
      setOtpCode(code)
      setOtpSecondsLeft(left)
    }
    compute()
    if (otpTimerRef.current) window.clearInterval(otpTimerRef.current)
    otpTimerRef.current = window.setInterval(compute, 1000) as unknown as number
    return () => { if (otpTimerRef.current) { window.clearInterval(otpTimerRef.current); otpTimerRef.current = null } }
  }, [selectedItem])

  // Filter handler with debouncing
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length > 0) {
        performSearch(query)
      } else {
        // Show all items when query is empty
        setResults(allItems.slice(0, 100))
      }
    }, 150)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, allItems])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  /**
   * Filter items based on search query
   */
  const performSearch = (searchQuery: string): void => {
    const query = searchQuery.toLowerCase().trim()
    
    const filtered = allItems.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(query)
      const usernameMatch = item.username?.toLowerCase().includes(query)
      const urlMatch = item.url?.toLowerCase().includes(query)
      const tagsMatch = item.tags?.some((tag) => 
        tag.toLowerCase().replace(/^#/, '').includes(query.replace(/^#/, ''))
      )
      return titleMatch || usernameMatch || urlMatch || tagsMatch
    })
    
    setResults(filtered.slice(0, 100)) // Limit to 100 results for performance
  }

  /**
   * Handle item selection - show detail view
   */
  const handleItemSelect = useCallback(async (item: SearchItem) => {
    setIsLoadingDetail(true)
    setSelectedItem(null)
    setShowSecret(false)

    try {
      // Fetch full item details from vault
      // This is a simplified version - in real implementation, fetch from vault API
      const response = await window.cloudpass.traySearchGetData()
      
      if (response.success) {
        const fullItem = response.data.find((i: any) => i.id === item.id)
        if (fullItem) {
          setSelectedItem(fullItem as ItemDetail)
          // After selecting, ensure detail view is focused for ESC handling
        }
      }
    } catch {
      // Failed to load item details
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  /**
   * Copy text to clipboard with notification
   */
  const copyToClipboard = useCallback((text: string, label: string) => {
    window.cloudpass.copyToClipboard(text)
    
    const notification = document.createElement('div')
    notification.textContent = `✓ ${label} copied`
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(34, 197, 94, 0.95);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 2000)
  }, [])

  /**
   * Go back to search results
   */
  const handleBack = useCallback(() => {
    if (selectedItem) {
      setSelectedItem(null)
      setShowSecret(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      window.close()
    }
  }, [selectedItem])

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      handleBack()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleItemSelect(results[activeIndex])
    }
  }, [results, activeIndex, handleItemSelect, handleBack])

  /**
   * Render category icon
   */
  const renderCategoryIcon = (category: string): React.JSX.Element => {
    const iconProps = { size: 14 }
    switch (category) {
      case 'passwords':
        return <PasswordIcon {...iconProps} />
      case 'api-keys':
        return <ApiKeyIcon {...iconProps} />
      case 'notes':
        return <NotesIcon {...iconProps} />
      case 'cards':
        return <CardsIcon {...iconProps} />
      default:
        return <PasswordIcon {...iconProps} />
    }
  }

  // Detail view
  if (selectedItem) {
    return (
      <div 
        className="flex flex-col h-screen bg-background text-foreground outline-none" 
        onKeyDown={handleKeyDown} 
        tabIndex={-1}
        data-detail-view
        ref={(el) => {
          if (el) {
            el.focus()
          }
        }}
      >
        {/* Header with back button */}
        <div className="flex-shrink-0 p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <h2 className="text-lg font-semibold flex-1 truncate">{selectedItem.title}</h2>
            <button
              onClick={() => window.close()}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Detail content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Category badge */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  {renderCategoryIcon(selectedItem.category)}
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {selectedItem.category.replace('-', ' ')} • {selectedItem.vaultId}
                </span>
              </div>

              {/* Username */}
              {selectedItem.username && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Username</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono">
                      {selectedItem.username}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedItem.username!, 'Username')}
                    >
                      <Icon name="copy" size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Password */}
              {selectedItem.password && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono">
                      {showSecret ? selectedItem.password : '••••••••••••'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      <Icon name={showSecret ? 'eye-off' : 'eye'} size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedItem.password!, 'Password')}
                    >
                      <Icon name="copy" size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* OTP */}
              {otpCode && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">One‑Time Code (TOTP)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm font-mono tracking-widest">
                      {otpCode}
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">{otpSecondsLeft}s</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(otpCode, 'OTP')}
                    >
                      <Icon name="copy" size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* URL */}
              {selectedItem.url && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">URL</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm truncate">
                      {selectedItem.url}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedItem.url!, 'URL')}
                    >
                      <Icon name="copy" size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedItem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedItem.notes && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                  <div className="px-3 py-2 rounded-lg bg-muted text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {selectedItem.notes}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-3 border-t border-border">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground gap-2">
            <button
              onClick={() => window.cloudpass.openMainApp()}
              className="px-2 py-1 rounded border border-border bg-muted text-xs"
            >
              Open App
            </button>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Esc</kbd>
            <span>Back</span>
          </div>
        </div>
      </div>
    )
  }

  // Search view
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="inline-flex p-1 rounded-lg bg-muted">
            <button
              onClick={() => onVaultSourceChange('cloud')}
              className={`px-3 py-1 rounded-md text-xs ${vaultSource === 'cloud' ? 'bg-background' : ''}`}
            >
              Cloud
            </button>
            <button
              onClick={() => onVaultSourceChange('local')}
              className={`px-3 py-1 rounded-md text-xs ${vaultSource === 'local' ? 'bg-background' : ''}`}
            >
              Local
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => window.cloudpass.openMainApp()}
              className="px-2 py-1 rounded border border-border bg-muted text-xs hover:bg-muted/80 transition-colors"
            >
              Add New
            </button>
            <button
              onClick={() => window.cloudpass.openMainApp()}
              className="px-2 py-1 rounded border border-border bg-muted text-xs hover:bg-muted/80 transition-colors"
            >
              Open App
            </button>
          </div>
        </div>
        <div className="relative">
          <Icon 
            name="search" 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" 
          />
          <Input
            ref={inputRef}
            type="text"
            placeholder={`Filter ${allItems.length} secrets...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-12 text-base bg-card border-border focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading secrets...</p>
          </div>
        )}

        {!isLoading && results.length === 0 && query && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon name="search" size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No results found for &quot;{query}&quot;</p>
          </div>
        )}

        {!isLoading && results.length === 0 && !query && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon name="lock" size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No secrets available</p>
            <p className="text-xs mt-2">Add secrets in the main app</p>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <>
            {/* Results count */}
            {query && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>
            )}
            <div className="space-y-1">
              {results.map((item, index) => (
                <button
                key={`${item.vaultId}-${item.id}`}
                onClick={() => handleItemSelect(item)}
                className={`
                  w-full text-left p-3 rounded-lg transition-colors
                  flex items-start gap-3 group
                  ${index === activeIndex ? 'bg-muted' : 'hover:bg-muted/50'}
                `}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 flex-shrink-0">
                  {renderCategoryIcon(item.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background/50 uppercase">
                      {item.vaultId}
                    </span>
                  </div>
                  {item.username && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.username}
                    </p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.cloudpass.openMainApp()
                    }}
                    className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center transition-colors"
                    title="Edit in app"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleItemSelect(item)
                    }}
                    className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center transition-colors"
                    title="View details"
                  >
                    <Icon name="chevron-right" size={14} />
                  </button>
                </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-2 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Enter</kbd>
            <span>View</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

