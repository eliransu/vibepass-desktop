import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './icon'

export type TagInputProps = {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
}

function normalizeTag(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return withHash.replace(/\s+/g, '-')
}

function uniqueTags(tags: string[]): string[] {
  const set = new Set<string>()
  for (const t of tags) {
    const n = normalizeTag(t)
    if (n) set.add(n)
  }
  return Array.from(set)
}

export function TagInput(props: TagInputProps): React.JSX.Element {
  const { t } = useTranslation()
  const { value, onChange, suggestions = [], placeholder, disabled } = props
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase().replace(/^#/, '')
    const taken = new Set(value.map(v => v.toLowerCase()))
    return suggestions
      .map(normalizeTag)
      .filter(Boolean)
      .filter(s => !taken.has(s.toLowerCase()))
      .filter(s => !q || s.toLowerCase().includes(q))
      .slice(0, 8)
  }, [input, suggestions, value])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  function addTag(raw: string) {
    const tag = normalizeTag(raw)
    if (!tag) return
    const next = uniqueTags([...(value || []), tag])
    onChange(next)
    setInput('')
    setOpen(false)
  }

  function removeTag(tag: string) {
    const next = (value || []).filter(t => t.toLowerCase() !== tag.toLowerCase())
    onChange(next)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      e.preventDefault()
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full border border-input rounded-lg bg-background px-2 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:border-transparent transition-all duration-200 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {(value || []).map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-secondary text-foreground border border-border">
          {tag}
          <button type="button" className="hover:opacity-80" onClick={() => removeTag(tag)} aria-label={t('actions.delete') as string}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm px-1 border-0 ring-0 focus:ring-0 focus:border-transparent appearance-none"
        placeholder={placeholder || (t('fields.tags') as string)}
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true) }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
      />
      {open && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-40 overflow-auto">
          <ul className="py-1 text-sm">
            {filteredSuggestions.map(s => (
              <li key={s}>
                <button type="button" className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => addTag(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


