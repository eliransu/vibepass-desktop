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
  if (!savedRegion) {
    throw new Error('Region is required but not provided')
  }
  const savedProfile = undefined
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = accountIdOverride || (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId'))
  if (!accountId) {
    throw new Error('AWS Account ID is required but not found in storage or provided as override')
  }

  if (selectedVaultId === 'personal') {
    // {tenant}/{user_id}/personal
    return { collectionPath: `${tenant}/${accountId}/${savedRegion}/${uid}/personal`, region: savedRegion as string, profile: savedProfile || undefined }
  }

  if (selectedVaultId === 'work') {
    // Shared department vault: {tenant}/{account}/{region}/shared/{department}
    const department = (typeof localStorage !== 'undefined' && localStorage.getItem('department')) || 'department'
    return { collectionPath: `${tenant}/${accountId}/${savedRegion}/shared/${department}`, region: savedRegion as string, profile: savedProfile || undefined }
  }

  // Invalid vault ID - only 'personal' and 'work' are supported
  throw new Error(`Invalid vault ID: ${selectedVaultId}. Only 'personal' and 'work' vaults are supported.`)
}

export function getVaultSecretName(params: { uid: string; selectedVaultId: string; email?: string | null }): string {
  const { uid, selectedVaultId, email } = params
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId'))
  if (!accountId) {
    throw new Error('AWS Account ID is required but not found in storage')
  }
  const region = ''
  if (selectedVaultId === 'work') {
    const department = (typeof localStorage !== 'undefined' && localStorage.getItem('department')) || 'department'
    return `cloudpass/${tenant}/${accountId}/${region}/${department}/vault`
  }
  if (selectedVaultId === 'personal') {
    return `cloudpass/${tenant}/${accountId}/${region}/${uid}/${selectedVaultId}/vault`
  }
  // Invalid vault ID - only 'personal' and 'work' are supported
  throw new Error(`Invalid vault ID: ${selectedVaultId}. Only 'personal' and 'work' vaults are supported.`)
}

export function getVaultSecretNameWithOverrides(params: { uid: string; selectedVaultId: string; email?: string | null; regionOverride?: string; accountIdOverride?: string }): string {
  const { uid, selectedVaultId, email, regionOverride, accountIdOverride } = params
  const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || deriveTenantFromEmail(email) || 'default'
  const accountId = accountIdOverride || (typeof localStorage !== 'undefined' && localStorage.getItem('awsAccountId'))
  if (!accountId) {
    throw new Error('AWS Account ID is required but not found in storage or provided as override')
  }
  const region = regionOverride || ''
  if (selectedVaultId === 'work') {
    const department = (typeof localStorage !== 'undefined' && localStorage.getItem('department')) || 'department'
    return `cloudpass/${tenant}/${accountId}/${region}/${department}/vault`
  }
  if (selectedVaultId === 'personal') {
    return `cloudpass/${tenant}/${accountId}/${region}/${uid}/${selectedVaultId}/vault`
  }
  // Invalid vault ID - only 'personal' and 'work' are supported
  throw new Error(`Invalid vault ID: ${selectedVaultId}. Only 'personal' and 'work' vaults are supported.`)
}



