import { deriveKeyFromMasterPassword, encryptJson, decryptJson } from '../../security/crypto'

describe('crypto primitives', () => {
  test('deriveKeyFromMasterPassword produces deterministic 256-bit key', () => {
    const key1 = deriveKeyFromMasterPassword('secret-pass', 'fixed-salt')
    const key2 = deriveKeyFromMasterPassword('secret-pass', 'fixed-salt')
    expect(key1).toEqual(key2)
    expect(typeof key1).toBe('string')
    expect(key1.length).toBeGreaterThan(32)
  })

  test('encryptJson and decryptJson roundtrip data', () => {
    const key = deriveKeyFromMasterPassword('p@ssw0rd', 's@lt')
    const payload = { a: 1, b: 'two', nested: { c: true } }
    const cipher = encryptJson(payload, key)
    expect(typeof cipher).toBe('string')
    const out = decryptJson<typeof payload>(cipher, key)
    expect(out).toEqual(payload)
  })
})


