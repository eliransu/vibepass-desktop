import { deriveTenantFromEmail, resolveVaultContext, getVaultSecretNameWithOverrides } from '../../services/vaultPaths'

describe('vaultPaths utilities', () => {
  const originalLocalStorage = globalThis.localStorage

  beforeEach(() => {
    // Minimal localStorage polyfill
    const store: Record<string, string> = {}
    globalThis.localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as any
  })

  afterEach(() => {
    // restore polyfill
    ;(globalThis as any).localStorage = originalLocalStorage
  })

  test('deriveTenantFromEmail extracts domain or defaults', () => {
    expect(deriveTenantFromEmail('user@example.com')).toBe('example.com')
    expect(deriveTenantFromEmail('user@Sub.Domain.IO')).toBe('sub.domain.io')
    expect(deriveTenantFromEmail(null)).toBe('default')
  })

  test('resolveVaultContext builds correct collection paths', () => {
    localStorage.setItem('awsProfile', 'default')
    localStorage.setItem('tenant', 'acme.io')
    localStorage.setItem('awsAccountId', '123456789012')

    const base = { uid: 'u1', selectedVaultId: 'personal', email: 'u@acme.io', regionOverride: 'us-east-1', accountIdOverride: '123456789012' }
    const personal = resolveVaultContext(base)
    expect(personal.collectionPath).toBe('acme.io/123456789012/us-east-1/u1/personal')

    const work = resolveVaultContext({ ...base, selectedVaultId: 'work' })
    expect(work.collectionPath).toBe('acme.io/123456789012/us-east-1/shared/team')

    const custom = resolveVaultContext({ ...base, selectedVaultId: 'vault-xyz' })
    expect(custom.collectionPath).toBe('acme.io/123456789012/us-east-1/u1/vault-xyz')
  })

  test('getVaultSecretNameWithOverrides encodes region/tenant/account', () => {
    const name = getVaultSecretNameWithOverrides({ uid: 'u1', selectedVaultId: 'personal', email: 'u@acme.io', regionOverride: 'eu-west-1', accountIdOverride: '999999999999' })
    expect(name).toBe('cloudpass.dev/acme.io/999999999999/eu-west-1/u1/personal/vault')

    const team = getVaultSecretNameWithOverrides({ uid: 'u1', selectedVaultId: 'work', email: 'u@acme.io', regionOverride: 'eu-west-1', accountIdOverride: '999999999999' })
    expect(team).toBe('cloudpass.dev/acme.io/999999999999/eu-west-1/team/vault')
  })
})


