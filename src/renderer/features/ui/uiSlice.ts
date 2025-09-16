import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type UiState = {
  selectedItemId: string | null
  searchQuery: string
  selectedVaultId: string
  sidebarCollapsed: boolean
  storageMode?: 'cloud' | 'local'
  awsRegion?: string
  awsProfile?: string
  awsAccountId?: string
  ssoRequired: boolean
}

const initialState: UiState = {
  selectedItemId: null,
  searchQuery: '',
  selectedVaultId: 'personal',
  sidebarCollapsed: false,
  // Region should not be stored; it is derived from AWS config (sso_region)
  storageMode: (typeof localStorage !== 'undefined' ? (localStorage.getItem('storageMode') as 'cloud' | 'local' | null) : null) || undefined,
  awsRegion: undefined,
  awsProfile: typeof localStorage !== 'undefined' ? localStorage.getItem('awsProfile') || undefined : undefined,
  awsAccountId: typeof localStorage !== 'undefined' ? localStorage.getItem('awsAccountId') || undefined : undefined,
  ssoRequired: false,
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
    setAwsProfile(state, action: PayloadAction<string | undefined>) {
      state.awsProfile = action.payload
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
          state.awsProfile = undefined
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
  },
})

export const { setSelectedItemId, setSearchQuery, setSelectedVaultId, toggleSidebar, setSidebarCollapsed, setAwsRegion, setAwsProfile, setAwsAccountId, setSsoRequired, setStorageMode } = slice.actions
export const uiReducer = slice.reducer


