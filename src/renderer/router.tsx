import React from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useNavigate, useRouteError } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from '../shared/store'
import { Shell } from './components/layout/Shell'
import { ToastProvider } from './components/ui/toast-provider'
import { MasterGate } from './features/security/MasterGate'
import { useDispatch } from 'react-redux'
import { setUser } from './features/auth/authSlice'
import { Icon } from './components/ui/icon'

// Firebase auth removed: gate app by Master password instead

const Passwords = React.lazy(() => import('./sections/Passwords'))
const ApiKeys = React.lazy(() => import('./sections/ApiKeys'))
const Notes = React.lazy(() => import('./sections/Notes'))
const Cards = React.lazy(() => import('./sections/Cards'))
// Team removed: vault selection controls data paths instead

function ErrorPage(): React.JSX.Element {
  const navigate = useNavigate()
  const error: any = useRouteError()
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="alert-circle" size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Unexpected error</h3>
        <p className="text-sm text-muted-foreground mb-4 break-words">{error?.statusText || error?.message || 'Something went wrong.'}</p>
        <button
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover"
          onClick={() => navigate('/passwords', { replace: true })}
        >
          Go to passwords
        </button>
      </div>
    </div>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: (
      <MasterGate>
        <Shell>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </Shell>
      </MasterGate>
    ),
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
    React.useEffect(() => {
      // Always resolve from OS; never reuse cached local user
      const preload = (window as any).cloudpass as any
      const applyUser = (user: any | null) => {
        if (user && user.uid) {
          localStorage.setItem('offlineUser', JSON.stringify(user))
          dispatch(setUser(user))
        } else {
          localStorage.removeItem('offlineUser')
          dispatch(setUser(null))
        }
      }
      if (preload && typeof preload.getOsUsername === 'function') {
        preload.getOsUsername().then((uname: string) => {
          const username = (uname || '').trim()
          if (username.length === 0) {
            applyUser(null)
            return
          }
          applyUser({
            uid: username,
            email: `${username}@cloudpass.local`,
            displayName: username,
            photoURL: ''
          })
        }).catch(() => {
          applyUser(null)
        })
      } else {
        applyUser(null)
      }
    }, [dispatch])
    return (
      <ToastProvider>
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


