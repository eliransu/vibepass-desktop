import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type UiState = {
  selectedItemId: string | null
  searchQuery: string
  selectedVaultId: string
  sidebarCollapsed: boolean
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
  },
})

export const { setSelectedItemId, setSearchQuery, setSelectedVaultId, toggleSidebar, setSidebarCollapsed, setAwsRegion, setAwsProfile, setAwsAccountId, setSsoRequired } = slice.actions
export const uiReducer = slice.reducer


