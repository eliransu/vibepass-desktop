import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type AuthUser = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

type AuthState = {
  user: AuthUser | null
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
}

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload
      state.status = action.payload ? 'authenticated' : 'unauthenticated'
    },
  },
})

export const { setUser } = slice.actions
export const authReducer = slice.reducer


