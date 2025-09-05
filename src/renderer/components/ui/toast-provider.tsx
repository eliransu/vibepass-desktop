import React, { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icon'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'success', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: Toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`
                pointer-events-auto animate-slide-in-right px-4 py-3 rounded-lg shadow-lg border max-w-sm bg-background
                ${toast.type === 'success' 
                  ? 'border-success/30 text-success' 
                  : toast.type === 'error'
                  ? 'border-destructive/30 text-destructive'
                  : 'border-border text-foreground'
                }
              `}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' && (
                  <Icon name="check-circle" size={16} className="flex-shrink-0" />
                )}
                {toast.type === 'error' && (
                  <Icon name="alert-triangle" size={16} className="flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="ml-auto text-current hover:opacity-70 transition-opacity"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
