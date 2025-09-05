import React from 'react'
import { Button } from './button'
import { Icon } from './icon'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false
}: ConfirmDialogProps): React.JSX.Element | null {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-background border border-border rounded-xl shadow-lg max-w-md w-full animate-scale-in">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {variant === 'destructive' ? (
              <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                <Icon name="alert-triangle" size={20} className="text-destructive" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Icon name="help-circle" size={20} className="text-primary" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3 justify-end">
            {cancelText && (
              <Button 
                variant="secondary" 
                onClick={onClose}
                disabled={loading}
              >
                {cancelText}
              </Button>
            )}
            <Button 
              variant={variant}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  {confirmText}
                </div>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
