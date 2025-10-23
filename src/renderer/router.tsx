import React, { useEffect } from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useNavigate, useRouteError } from 'react-router-dom'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { store, RootState } from '../shared/store'
import { vaultApi } from './services/vaultApi'
import { Shell } from './components/layout/Shell'
import { ToastProvider } from './components/ui/toast-provider'
import { MasterGate } from './features/security/MasterGate'
import { setUser } from './features/auth/authSlice'
import { setSsoRequired } from './features/ui/uiSlice'
import { ModeSelect } from './sections/ModeSelect'
import { Icon } from './components/ui/icon'
import { useSafeToast } from './hooks/useSafeToast'
import { useTranslation } from 'react-i18next'

// Firebase auth removed: gate app by Master password instead

const Passwords = React.lazy(() => import('./sections/Passwords').then(m => ({ default: m.Passwords })))
const ApiKeys = React.lazy(() => import('./sections/ApiKeys').then(m => ({ default: m.ApiKeys })))
const Notes = React.lazy(() => import('./sections/Notes').then(m => ({ default: m.Notes })))
const Cards = React.lazy(() => import('./sections/Cards').then(m => ({ default: m.Cards })))
// Team removed: vault selection controls data paths instead

function ErrorPage(): React.JSX.Element {
  const navigate = useNavigate()
  const error = useRouteError() as { statusText?: string; message?: string } | null
  const { t } = useTranslation()
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="alert-circle" size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">{t('errors.unknownError')}</h3>
        <p className="text-sm text-muted-foreground mb-4 break-words">{error?.statusText || error?.message || ''}</p>
        <button
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover"
          onClick={() => navigate('/passwords', { replace: true })}
        >
          {t('nav.passwords')}
        </button>
      </div>
    </div>
  )
}

const router = createHashRouter([
  { path: '/mode', element: <ModeSelect /> },
  {
    path: '/',
    element: <RootSwitch />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/passwords" replace /> },
      { path: 'passwords', element: <Passwords /> },
      { path: 'api-keys', element: <ApiKeys /> },
      { path: 'notes', element: <Notes /> },
      { path: 'cards', element: <Cards /> },
    ],
  },
])

export function AppRouter(): React.JSX.Element {
  function WithAuth(): React.JSX.Element {
    const dispatch = useDispatch()
    const storageMode = useSelector((s: RootState) => s.ui.storageMode)
    const ssoRequired = useSelector((s: RootState) => s.ui.ssoRequired)
    React.useEffect(() => {
      // Always resolve from AWS STS; never reuse cached local user
      const preload = window.cloudpass
      const applyUser = (user: { uid: string; email: string; displayName: string; photoURL: string } | null) => {
        if (user && user.uid) {
          localStorage.setItem('offlineUser', JSON.stringify(user))
          dispatch(setUser(user))
        } else {
          localStorage.removeItem('offlineUser')
          dispatch(setUser(null))
        }
      }
      async function resolveIdentity(): Promise<void> {
        if (storageMode === 'local') {
          const uid = 'local-user'
          applyUser({ uid, email: 'local@vault', displayName: 'Local', photoURL: '' })
          dispatch(setSsoRequired(false))
          return
        }
        if (storageMode !== 'cloud') {
          // No selection yet; do not attempt AWS
          return
        }
        if (!(preload && typeof preload.getAwsUserIdentity === 'function')) { applyUser(null); return }
        try {
          const res = await preload.getAwsUserIdentity()
          if (res.ok === true) {
            const username = String(res.userId || '').trim()
            if (username.length === 0) { applyUser(null); return }
            applyUser({ uid: username, email: `${username}@cloudpass.aws`, displayName: username, photoURL: '' })
            dispatch(setSsoRequired(false))
            return
          }
          if (res.code === 'SessionRequired') {
            // Avoid flashing a toast on startup; just set state and return
            dispatch(setSsoRequired(true))
            applyUser(null)
            return
          }
          const event = new CustomEvent('aws-identity-error', { detail: { message: res.error, code: res.code || 'UnknownError' } })
          window.dispatchEvent(event)
          applyUser(null)
        } catch (e: unknown) {
          const message = typeof e === 'object' && e && 'message' in e ? String((e as { message?: unknown }).message) : 'Unknown error'
          const code = typeof e === 'object' && e && 'name' in e ? String((e as { name?: unknown }).name) : 'UnknownError'
          const event = new CustomEvent('aws-identity-error', { detail: { message, code } })
          window.dispatchEvent(event)
          applyUser(null)
        }
      }
      void resolveIdentity()
    }, [dispatch, storageMode, ssoRequired])

    // After SSO success (ssoRequired becomes false), force RTK Query cache reset to refetch vault data
    React.useEffect(() => {
      if (storageMode === 'cloud' && ssoRequired === false) {
        try { store.dispatch(vaultApi.util.resetApiState()) } catch {}
      }
    }, [ssoRequired, storageMode])
    return (
      <ToastProvider>
        <VaultErrorHandler />
        <RouterProvider router={router} />
      </ToastProvider>
    )
  }
  return (
    <Provider store={store}>
      <WithAuth />
    </Provider>
  )
}

function RootSwitch(): React.JSX.Element {
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  if (!storageMode) {
    return <ModeSelect />
  }
  return (
    <MasterGate>
      <Shell>
        <React.Suspense fallback={null}>
          <Outlet />
        </React.Suspense>
      </Shell>
    </MasterGate>
  )
}

function VaultErrorHandler(): React.JSX.Element {
  const { showToast } = useSafeToast()
  const { t } = useTranslation()

  useEffect(() => {
    function handleAwsIdentityError(event: CustomEvent) {
      const { message, code } = event.detail || {}
      // Avoid duplicate toasts; Shell shows SessionRequired and SSO login failures
      if (code === 'SessionRequired' || code === 'SsoLoginFailed') {
        return
      }
      const display = `${t('errors.identityFailed') || 'Identity failed'}: ${message || code || 'Unknown error'}`
      showToast(display, 'error')
      console.error('❌ AWS Identity error:', code, message)
    }
    function handleVaultAccessDenied(event: CustomEvent) {
      const { message, secretName } = event.detail
      showToast(`${t('errors.vaultAccessDenied')}: ${t('errors.vaultAccessDeniedDescription')}`, 'error')
      console.error('🚫 Vault access denied for:', secretName, '-', message)
    }

    window.addEventListener('vault-access-denied', handleVaultAccessDenied as EventListener)
    window.addEventListener('aws-identity-error', handleAwsIdentityError as EventListener)
    return () => {
      window.removeEventListener('vault-access-denied', handleVaultAccessDenied as EventListener)
      window.removeEventListener('aws-identity-error', handleAwsIdentityError as EventListener)
    }
  }, [showToast, t])

  return <></>
}


