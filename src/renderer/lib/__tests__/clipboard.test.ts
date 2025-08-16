import { copyToClipboard } from '../../lib/clipboard'

describe('copyToClipboard', () => {
  const original = { vibepass: (global as any).window?.vibepass }

  beforeEach(() => {
    ;(global as any).window = { vibepass: undefined }
    // Attach clipboard to existing navigator (jsdom defines navigator)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
    ;(global as any).document = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ style: {}, setAttribute: () => {}, focus: () => {}, select: () => {}, setSelectionRange: () => {} }),
      execCommand: () => true,
    } as any
  })

  afterEach(() => {
    ;(global as any).window.vibepass = original.vibepass
  })

  test('uses modern navigator.clipboard when available', async () => {
    const ok = await copyToClipboard('hello')
    expect(ok).toBe(true)
    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith('hello')
  })
})


