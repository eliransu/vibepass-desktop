export function normalizeTag(input: string): string {
  const trimmed = (input || '').trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return withHash.replace(/\s+/g, '-')
}

export function dedupeTags(tags: string[] | undefined | null): string[] {
  const set = new Set<string>()
  for (const t of tags || []) {
    const n = normalizeTag(t)
    if (n) set.add(n)
  }
  return Array.from(set)
}

export function mergeKnownTags(newTags: string[]): string[] {
  try {
    const raw = localStorage.getItem('knownTags') || '[]'
    const current = JSON.parse(raw) as string[]
    const set = new Set<string>(current.map((t) => normalizeTag(t)))
    for (const t of newTags) set.add(normalizeTag(t))
    const merged = Array.from(set).filter(Boolean).slice(0, 200)
    localStorage.setItem('knownTags', JSON.stringify(merged))
    return merged
  } catch {
    const unique = dedupeTags(newTags)
    try { localStorage.setItem('knownTags', JSON.stringify(unique)) } catch {}
    return unique
  }
}

export function getTagColorClass(tag: string): string {
  const colors = [
    'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'bg-green-500/15 text-green-400 border-green-500/30',
    'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'bg-pink-500/15 text-pink-400 border-pink-500/30',
    'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    'bg-red-500/15 text-red-400 border-red-500/30',
    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  ]
  let hash = 0
  const str = (tag || '').toLowerCase()
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  const idx = hash % colors.length
  return colors[idx]
}


