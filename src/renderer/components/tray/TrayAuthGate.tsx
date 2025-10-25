import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/icon'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

type TrayAuthGateProps = {
  onAuthenticated: (masterKey: string) => void
}

/**
 * Authentication gate for tray search
 * Requires biometric or master password before accessing secrets
 */
export function TrayAuthGate({ onAuthenticated }: TrayAuthGateProps): React.JSX.Element {
  const [useBiometric, setUseBiometric] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if biometric is available
  useEffect(() => {
    async function checkBiometric() {
      try {
        const available = await window.cloudpass.biometricCheck()
        setUseBiometric(available)
        if (available) {
          // Delay biometric prompt slightly to let window settle
          setTimeout(() => {
            handleBiometricAuth()
          }, 300)
        } else {
          // Focus password input
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      } catch {
        setUseBiometric(false)
      }
    }
    void checkBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true)
    setError('')
    try {
      const masterKey = await window.cloudpass.biometricRetrieve()
      if (masterKey) {
        onAuthenticated(masterKey)
        // Focus search field on next tick
        setTimeout(() => {
          const el = document.querySelector('input[type="text"]') as HTMLInputElement | null
          el?.focus()
          el?.select()
        }, 50)
      } else {
        setError('Biometric authentication failed')
        setUseBiometric(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } catch {
      setError('Biometric authentication cancelled')
      setUseBiometric(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setIsAuthenticating(true)
    setError('')

    // Simple validation - in real app, you'd verify against stored hash
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsAuthenticating(false)
      return
    }

    // Pass the master key to parent
    onAuthenticated(password)
    setTimeout(() => {
      const el = document.querySelector('input[type="text"]') as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.close()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="lock" size={32} className="text-primary" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-center mb-2">
            Authenticate to Search
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Unlock quick search to access your secrets
          </p>

          {/* Biometric option */}
          {useBiometric && !error && (
            <div className="text-center mb-6">
              <Button
                onClick={handleBiometricAuth}
                disabled={isAuthenticating}
                className="w-full"
              >
                {isAuthenticating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Icon name="fingerprint" size={16} className="mr-2" />
                    Use Touch ID
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          )}

          {/* Password form */}
          <form onSubmit={handlePasswordAuth}>
            <div className="mb-4">
              <Input
                ref={inputRef}
                type="password"
                placeholder="Master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAuthenticating}
                className="w-full"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isAuthenticating || !password.trim()}
              className="w-full"
            >
              {isAuthenticating ? 'Unlocking...' : 'Unlock'}
            </Button>
          </form>

          {/* Hint */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

