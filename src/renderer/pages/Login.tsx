import React from 'react'
import { Button } from '../components/ui/button'
import { useTranslation } from 'react-i18next'
import { auth, googleProvider, firebaseEnabled } from '../../shared/firebase'
import { signInWithPopup, signInWithRedirect, Auth } from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { setUser } from '../features/auth/authSlice'

export function Login(): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [loading, setLoading] = React.useState(false)

  async function handleGoogle(): Promise<void> {
    if (!auth || !googleProvider) return
    try {
      setLoading(true)
      const res = await signInWithPopup(auth as Auth, googleProvider)
      const u = res.user
      dispatch(setUser({ uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL }))
    } catch (e: any) {
      if (true || String(e?.code ?? '').includes('popup-blocked')) {
        setLoading(true)
        await signInWithRedirect(auth, googleProvider)
      } else {
        console.error(e)
      }
    } finally {
      setLoading(false)
    }
  }

  // No logout on login screen

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('app.title')}</h1>
          <p className="text-muted-foreground">{t('app.welcome')}</p>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">{t('auth.signIn')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('auth.signInDescription')}
              </p>
            </div>

            {!firebaseEnabled ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <div className="font-medium text-destructive">{t('auth.configurationError')}</div>
                    <div className="text-sm text-destructive/80 mt-1">{t('auth.misconfigured')}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Button 
                  onClick={handleGoogle} 
                  className="w-full h-12 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-70"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {t('auth.signingIn')}
                    </span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t('auth.google')}
                    </>
                  )}
                </Button>
                
                {/* Optional secondary actions could go here */}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>{t('auth.secureNote')}</p>
        </div>
      </div>
    </div>
  )
}


