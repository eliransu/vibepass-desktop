import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type State = {
  key: string | null
  isUnlocking: boolean
}

const initialState: State = { key: null, isUnlocking: false }

const slice = createSlice({
  name: 'masterKey',
  initialState,
  reducers: {
    setMasterKey(state, action: PayloadAction<string | null>) {
      state.key = action.payload
      state.isUnlocking = false
    },
    setUnlocking(state, action: PayloadAction<boolean>) {
      state.isUnlocking = action.payload
    },
  },
})

export const { setMasterKey, setUnlocking } = slice.actions
export const masterKeyReducer = slice.reducer


