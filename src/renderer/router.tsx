import React from 'react'
import { createHashRouter, RouterProvider, Navigate, Outlet, useNavigate, useRouteError } from 'react-router-dom'
import { Login } from './pages/Login'
import { Provider, useSelector } from 'react-redux'
import { store, RootState } from '../shared/store'
import { useAuthListener } from './hooks/useAuthListener'
import { Shell } from './components/layout/Shell'
import { ToastProvider } from './components/ui/toast-provider'

function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const user = useSelector((s: RootState) => s.auth.user)
  return user ? <>{children}</> : <Login />
}

const Passwords = React.lazy(() => import('./sections/Passwords'))
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
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.119-3 2.5S10.343 13 12 13s3-1.119 3-2.5S13.657 8 12 8zm0 0V6m0 7v2m9-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
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
      <RequireAuth>
        <Shell>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </Shell>
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/passwords" replace /> },
      { path: 'passwords', element: <Passwords /> },
      { path: 'notes', element: <Notes /> },
      { path: 'cards', element: <Cards /> },
    ],
  },
])

export function AppRouter(): React.JSX.Element {
  function WithAuth(): React.JSX.Element {
    useAuthListener()
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


