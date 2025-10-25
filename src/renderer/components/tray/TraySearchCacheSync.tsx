import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { useListQuery } from '../../services/vaultApi'
import { TraySearchSyncService } from '../../services/traySearchSync'

/**
 * Component that synchronizes vault data with tray search cache
 * Automatically updates the cache when vault data changes
 */
export function TraySearchCacheSync(): null {
  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)

  const syncService = TraySearchSyncService.getInstance()

  // Fetch personal vault data
  const { data: personalData } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId: 'personal',
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode !== 'cloud' })

  // Fetch work vault data
  const { data: workData } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId: 'work',
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode !== 'cloud' })

  // Fetch local vault data
  const { data: localData } = useListQuery({
    uid: user?.uid ?? '',
    key: key ?? '',
    selectedVaultId,
    regionOverride: awsRegion,
    accountIdOverride: awsAccountId,
  }, { skip: !(user?.uid && key) || storageMode === 'cloud' })

  // Sync data whenever vault data changes
  useEffect(() => {
    if (storageMode === 'cloud') {
      // Combine personal and work data for cloud mode
      const allData = [
        ...(personalData || []).map((item) => ({ ...item, vaultId: 'personal' as const })),
        ...(workData || []).map((item) => ({ ...item, vaultId: 'work' as const })),
      ]
      void syncService.syncVaultData(allData)
    } else if (storageMode === 'local' && localData) {
      // Sync local vault data
      const withVaultId = localData.map((item) => ({ 
        ...item, 
        vaultId: (selectedVaultId as 'personal' | 'work') || 'personal' 
      }))
      void syncService.syncVaultData(withVaultId)
    }
  }, [personalData, workData, localData, storageMode, selectedVaultId, syncService])

  // Clear cache on unmount or when user logs out
  useEffect(() => {
    return () => {
      if (!user || !key) {
        void syncService.clearCache()
      }
    }
  }, [user, key, syncService])

  // This component doesn't render anything
  return null
}

