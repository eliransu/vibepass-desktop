import type { VaultItem } from './vaultApi'

/**
 * Synchronizes vault data with the tray search cache
 * Updates the main process cache whenever vault data changes
 */
export class TraySearchSyncService {
  private static instance: TraySearchSyncService | null = null
  private lastSyncedData: string = ''

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TraySearchSyncService {
    if (!TraySearchSyncService.instance) {
      TraySearchSyncService.instance = new TraySearchSyncService()
    }
    return TraySearchSyncService.instance
  }

  /**
   * Sync vault items to tray search cache
   * Converts VaultItems to searchable format and updates main process
   * Includes sensitive data (will be accessed after tray authentication)
   */
  public async syncVaultData(items: VaultItem[]): Promise<void> {
    try {
      // Convert to searchable format with full data
      const searchData = items.map((item) => ({
        id: item.id,
        title: item.title,
        username: item.username,
        password: item.password,
        url: item.url,
        notes: item.notes,
        category: item.category || 'passwords',
        vaultId: 'personal', // This will be enhanced when we know which vault
        tags: item.tags || [],
      }))

      // Check if data has changed (avoid unnecessary IPC calls)
      const dataString = JSON.stringify(searchData)
      if (dataString === this.lastSyncedData) {
        return
      }

      // Update cache in main process
      const success = await window.cloudpass.traySearchUpdateCache(searchData)
      
      if (success) {
        this.lastSyncedData = dataString
      }
    } catch {
      // Failed to sync tray search data
    }
  }

  /**
   * Clear the cache
   */
  public async clearCache(): Promise<void> {
    try {
      await window.cloudpass.traySearchUpdateCache([])
      this.lastSyncedData = ''
    } catch {
      // Failed to clear tray search cache
    }
  }
}

/**
 * Hook to sync vault data with tray search
 * Call this whenever vault data is updated
 */
export function useTraySearchSync() {
  const syncService = TraySearchSyncService.getInstance()

  return {
    syncData: (items: VaultItem[]) => syncService.syncVaultData(items),
    clearCache: () => syncService.clearCache(),
  }
}

