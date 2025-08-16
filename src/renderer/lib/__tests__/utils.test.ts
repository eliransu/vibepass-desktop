import { cn } from '../../lib/utils'

describe('cn', () => {
  test('merges classnames and tailwind conflicts', () => {
    const out = cn('p-2', 'text-sm', 'p-3', { hidden: false, block: true })
    expect(out).toContain('text-sm')
    expect(out).toContain('block')
    // tailwind-merge keeps the last padding utility
    expect(out.includes('p-3')).toBe(true)
    expect(out.includes('p-2')).toBe(false)
  })
})


