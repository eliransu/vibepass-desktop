import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type UiState = {
  selectedItemId: string | null
  searchQuery: string
  selectedVaultId: string
  sidebarCollapsed: boolean
  storageMode?: 'cloud' | 'local'
  awsRegion?: string
  awsAccountId?: string
  ssoRequired: boolean
  // Global command palette visibility
  commandPaletteOpen?: boolean
}

const initialState: UiState = {
  selectedItemId: null,
  searchQuery: '',
  selectedVaultId: 'personal',
  sidebarCollapsed: false,
  // Region should not be stored; it is derived from AWS config (sso_region)
  storageMode: (typeof localStorage !== 'undefined' ? (localStorage.getItem('storageMode') as 'cloud' | 'local' | null) : null) || undefined,
  awsRegion: undefined,
  awsAccountId: typeof localStorage !== 'undefined' ? localStorage.getItem('awsAccountId') || undefined : undefined,
  ssoRequired: false,
  commandPaletteOpen: false,
}

const slice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedItemId(state, action: PayloadAction<string | null>) {
      state.selectedItemId = action.payload
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload
    },
    setSelectedVaultId(state, action: PayloadAction<string>) {
      state.selectedVaultId = action.payload
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload
    },
    setAwsRegion(state, action: PayloadAction<string | undefined>) {
      state.awsRegion = action.payload
    },
    setAwsAccountId(state, action: PayloadAction<string | undefined>) {
      state.awsAccountId = action.payload
    },
    setSsoRequired(state, action: PayloadAction<boolean>) {
      state.ssoRequired = action.payload
    },
    setStorageMode(state, action: PayloadAction<'cloud' | 'local' | undefined>) {
      const nextMode = action.payload
      const prevMode = state.storageMode
      state.storageMode = nextMode
      // Reset UI navigation/search/vault selection whenever mode changes
      if (nextMode !== prevMode) {
        state.selectedItemId = null
        state.searchQuery = ''
        state.selectedVaultId = 'personal'
        // Clear AWS-related UI flags when switching to local
        if (nextMode === 'local') {
          state.ssoRequired = false
          state.awsRegion = undefined
          state.awsAccountId = undefined
        }
      }
      try {
        if (typeof localStorage !== 'undefined') {
          if (nextMode) localStorage.setItem('storageMode', nextMode)
          else localStorage.removeItem('storageMode')
        }
      } catch {}
    },
    setCommandPaletteOpen(state, action: PayloadAction<boolean>) {
      state.commandPaletteOpen = action.payload
    },
    toggleCommandPalette(state) {
      state.commandPaletteOpen = !state.commandPaletteOpen
    },
  },
})

export const { setSelectedItemId, setSearchQuery, setSelectedVaultId, toggleSidebar, setSidebarCollapsed, setAwsRegion, setAwsAccountId, setSsoRequired, setStorageMode, setCommandPaletteOpen, toggleCommandPalette } = slice.actions
export const uiReducer = slice.reducer


