import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../shared/store'
import { setMasterKey, setUnlocking } from './masterKeySlice'
import CryptoJS from 'crypto-js'
import { deriveKeyFromMasterPassword } from '../../../shared/security/crypto'
import { useTranslation } from 'react-i18next'

const VERIFIER_PLAINTEXT = 'cloudpass.com.VerifierV1'

export function MasterGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const masterKey = useSelector((s: RootState) => s.masterKey.key)
  const isUnlocking = useSelector((s: RootState) => s.masterKey.isUnlocking)
  const [hasSetup, setHasSetup] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [attemptedBiometric, setAttemptedBiometric] = useState(false)

  useEffect(() => {
    void (async () => {
      const salt = await window.cloudpass.storeGet<string>('salt')
      const verifier = await window.cloudpass.storeGet<string>('verifier')
      const setupComplete = Boolean(salt && verifier)
      setHasSetup(setupComplete)
      
      // Check if biometric authentication is available (no auto-unlock)
      const hasBiometric = await window.cloudpass.biometricCheck()
      setBiometricAvailable(hasBiometric)
    })()
  }, [])

  // Auto-lock disabled; only explicit lock should clear the key (not used now)

  const disabled = useMemo(() => {
    if (hasSetup === null) return true
    if (!hasSetup) return password.length < 8 || password !== confirm
    return password.length < 1
  }, [hasSetup, password, confirm])

  async function tryBiometricUnlock(): Promise<void> {
    try {
      setBiometricLoading(true)
      setError(null)
      
      // This will prompt the user for biometric authentication (Touch ID, Face ID, Windows Hello, etc.)
      const biometricPassword = await window.cloudpass.biometricRetrieve()
      
      if (biometricPassword) {
        const existingSalt = await window.cloudpass.storeGet<string>('salt')
        const existingVerifier = await window.cloudpass.storeGet<string>('verifier')
        
        if (existingSalt && existingVerifier) {
          const key = deriveKeyFromMasterPassword(biometricPassword, existingSalt)
          const plain = CryptoJS.AES.decrypt(existingVerifier, key).toString(CryptoJS.enc.Utf8)
          if (plain === VERIFIER_PLAINTEXT) {
            dispatch(setUnlocking(true))
            // Add a delay to show the unlock animation
            setTimeout(() => {
              dispatch(setMasterKey(key))
            }, 1500)
            return
          } else {
            setError(t('master.biometric.invalid'))
          }
        }
      } // if user cancelled or biometric not available, fall through silently to password UI
    } catch (err: any) {
      console.error('Biometric unlock failed:', err)
      // Don't show error if user just cancelled
      if (!err.message?.includes('cancel') && !err.message?.includes('Cancel')) {
        setError(t('master.biometric.error'))
      }
    } finally {
      setBiometricLoading(false)
    }
  }

  // Auto-prompt biometric by default once, then fall back to password if cancelled/closed
  useEffect(() => {
    if (!attemptedBiometric && hasSetup && biometricAvailable && !masterKey) {
      setAttemptedBiometric(true)
      void tryBiometricUnlock()
    }
  }, [attemptedBiometric, hasSetup, biometricAvailable, masterKey])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      const existingSalt = await window.cloudpass.storeGet<string>('salt')
      const existingVerifier = await window.cloudpass.storeGet<string>('verifier')
      if (!existingSalt || !existingVerifier) {
        // First time setup
        const salt = CryptoJS.lib.WordArray.random(16).toString()
        const key = deriveKeyFromMasterPassword(password, salt)
        const ciphertext = CryptoJS.AES.encrypt(VERIFIER_PLAINTEXT, key).toString()
        await window.cloudpass.storeSet('salt', salt)
        await window.cloudpass.storeSet('verifier', ciphertext)
        
        // Store password for biometric authentication (will prompt user for permission)
        const biometricStored = await window.cloudpass.biometricStore(password)
        if (biometricStored) {
          setBiometricAvailable(true)
        }
        
        dispatch(setUnlocking(true))
        // Add a delay to show the unlock animation
        setTimeout(() => {
          dispatch(setMasterKey(key))
        }, 1500)
        return
      }
      // Login
      const key = deriveKeyFromMasterPassword(password, existingSalt)
      const plain = CryptoJS.AES.decrypt(existingVerifier, key).toString(CryptoJS.enc.Utf8)
      if (plain !== VERIFIER_PLAINTEXT) {
        setError(t('master.invalid'))
        return
      }
      
      // Update biometric store with successful password (will prompt user for permission)
      if (!biometricAvailable) {
        const biometricStored = await window.cloudpass.biometricStore(password)
        if (biometricStored) {
          setBiometricAvailable(true)
        }
      }
      
      dispatch(setUnlocking(true))
      // Add a delay to show the unlock animation
      setTimeout(() => {
        dispatch(setMasterKey(key))
      }, 1500)
    } catch (err: any) {
      setError(err?.message ?? 'Error')
    }
  }

  if (masterKey) return <>{children}</>
  
  // Show unlock animation
  if (isUnlocking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="text-center">
          <div className="relative mb-8">
            {/* Outer expanding ring */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-4 border-primary/20 animate-ping"></div>
            {/* Middle ring */}
            <div className="absolute inset-2 w-20 h-20 mx-auto rounded-full border-2 border-primary/40 animate-pulse delay-150"></div>
            {/* Inner icon */}
            <div className="relative w-24 h-24 mx-auto bg-primary rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-12 h-12 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-lg font-semibold text-primary animate-pulse mb-2">
            {t('master.unlocking')}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('master.welcome')}
          </div>
        </div>
      </div>
    )
  }
  
  if (hasSetup === null || biometricLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          {biometricLoading ? (
            <div className="relative mb-6">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-primary mb-2">
                {t('master.biometric.prompt')}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('master.biometric.instruction')}
              </div>
            </div>
          ) : (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          )}
          <div className="text-sm text-muted-foreground">
            {biometricLoading ? '' : t('master.loading')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl shadow-xl bg-background">
        <div className="flex justify-center py-8">
          {/* eslint-disable-next-line */}
          {/* @ts-ignore */}
          <dotlottie-player
            src="https://lottie.host/6475dcd7-35cf-4d93-ac92-01268a2bea4b/3XzoO49bNF.lottie"
            autoplay
            loop
            background="transparent"
            style={{ width: 112, height: 112 }}
          />
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-4">
          <h1 className="text-xl font-semibold text-center">{hasSetup ? t('master.unlock') : t('master.create')}</h1>
          <div className="space-y-2">
            <label className="block text-sm">{t('master.password')}</label>
            <input autoFocus type="password" className="w-full border rounded px-3 py-2 bg-background" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {!hasSetup && (
            <div className="space-y-2">
              <label className="block text-sm">{t('master.confirm')}</label>
              <input type="password" className="w-full border rounded px-3 py-2 bg-background" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex flex-col gap-3 items-center">
            <button disabled={disabled} className="w-full h-10 rounded bg-primary text-primary-foreground disabled:opacity-50 max-w-xs">
              {hasSetup ? t('master.unlockBtn') : t('master.createBtn')}
            </button>
            {hasSetup && (
              <button 
                type="button" 
                onClick={tryBiometricUnlock}
                disabled={biometricLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {biometricAvailable ? (biometricLoading ? t('master.biometric.unlocking') : t('master.biometric.unlock')) : t('master.biometric.invalid')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}


