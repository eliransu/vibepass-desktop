export type VaultContext = {
  collectionPath: string
  region: string
  profile?: string
}

export function deriveTenantFromEmail(email: string | undefined | null): string {
  const raw = (email || '').split('@')[1] || 'default'
  return raw.trim().toLowerCase()
}

export function resolveVaultContext(params: { uid: string; selectedVaultId: string; email?: string | null; regionOverride?: string; accountIdOverride?: string }): VaultContext {
  const { uid, selectedVaultId, email, regionOverride, accountIdOverride } = params
  // Region is provided by caller; do not read from storage
  const savedRegion = regionOverride || ''
  const savedProfile = (typeof localStorage !== 'undefined' && localStorage.getItem('awsProfile'))
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = accountIdOverride || ((typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId')) || 'unknown')

  if (selectedVaultId === 'personal') {
    // {tenant}/{user_id}/personal
    return { collectionPath: `${tenant}/${accountId}/${savedRegion}/${uid}/personal`, region: savedRegion as string, profile: savedProfile || undefined }
  }

  if (selectedVaultId === 'work') {
    // Shared/team at tenant level: {tenant}/shared/team
    return { collectionPath: `${tenant}/${accountId}/${savedRegion}/shared/team`, region: savedRegion as string, profile: savedProfile || undefined }
  }

  // Custom vaults: {tenant}/{user_id}/{custom}
  return { collectionPath: `${tenant}/${accountId}/${savedRegion}/${uid}/${selectedVaultId}`, region: savedRegion as string, profile: savedProfile || undefined }
}

export function getVaultSecretName(params: { uid: string; selectedVaultId: string; email?: string | null }): string {
  const { uid, selectedVaultId, email } = params
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId')) || 'unknown'
  const region = ''
  if (selectedVaultId === 'work') {
    return `vibepass/${tenant}/${accountId}/${region}/team/vault`
  }
  return `vibepass/${tenant}/${accountId}/${region}/${uid}/${selectedVaultId}/vault`
}

export function getVaultSecretNameWithOverrides(params: { uid: string; selectedVaultId: string; email?: string | null; regionOverride?: string; accountIdOverride?: string }): string {
  const { uid, selectedVaultId, email, regionOverride, accountIdOverride } = params
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = accountIdOverride || ((typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId')) || 'unknown')
  const region = regionOverride || ''
  if (selectedVaultId === 'work') {
    return `vibepass/${tenant}/${accountId}/${region}/team/vault`
  }
  return `vibepass/${tenant}/${accountId}/${region}/${uid}/${selectedVaultId}/vault`
}


