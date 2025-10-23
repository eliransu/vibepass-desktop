import { copyToClipboard } from '../../lib/clipboard'

describe('copyToClipboard', () => {
  const original = { cloudpass: (global as unknown as { window?: { cloudpass?: unknown } }).window?.cloudpass }

  beforeEach(() => {
    ;(global as unknown as { window: unknown }).window = { cloudpass: undefined } as unknown as Window
    // Attach clipboard to existing navigator (jsdom defines navigator)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
    ;(global as unknown as { document: unknown }).document = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ style: {}, setAttribute: () => {}, focus: () => {}, select: () => {}, setSelectionRange: () => {} }),
      execCommand: () => true,
    } as unknown as Document
  })

  afterEach(() => {
    ;((global as unknown as { window: { cloudpass?: unknown } }).window).cloudpass = original.cloudpass
  })

  test('uses modern navigator.clipboard when available', async () => {
    const ok = await copyToClipboard('hello')
    expect(ok).toBe(true)
    expect((navigator as unknown as { clipboard: { writeText: jest.Mock } }).clipboard.writeText).toHaveBeenCalledWith('hello')
  })
})


