import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from '../renderer/features/auth/authSlice'
import { masterKeyReducer } from '../renderer/features/security/masterKeySlice'
import { vaultApi } from '../renderer/services/vaultApi'
import { uiReducer } from '../renderer/features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    masterKey: masterKeyReducer,
    ui: uiReducer,
    [vaultApi.reducerPath]: vaultApi.reducer,
  },
  middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(vaultApi.middleware),
})

export type AppStore = typeof store
export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>


