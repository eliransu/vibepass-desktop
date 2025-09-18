import React from 'react'
import type { VaultItem } from '../../services/vaultApi'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Icon } from '../../components/ui/icon'
import { useTranslation } from 'react-i18next'
import { TagInput } from '../../components/ui/tag-input'

export type PasswordFormData = {
  title: string
  username: string
  password: string
  url: string
  notes: string
  tags?: string[]
}

export type PasswordFormProps = {
  isSubmitting: boolean
  editingPassword: VaultItem | null
  formData: PasswordFormData
  setFormData: React.Dispatch<React.SetStateAction<PasswordFormData>>
  onSubmit: (e: React.FormEvent) => Promise<void>
  onCancel: () => void
  onScanQr: () => Promise<void>
  otpActive: boolean
  currentOtpCode: string
  otpSecondsLeft: number
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
}

export function PasswordForm(props: PasswordFormProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    isSubmitting,
    editingPassword,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    onScanQr,
    otpActive,
    currentOtpCode,
    otpSecondsLeft,
    showPassword,
    setShowPassword,
  } = props

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {editingPassword ? t('actions.editPassword') : t('actions.addPassword')}
          </h2>
          <Button variant="ghost" onClick={onCancel}>
            <Icon name="x" size={16} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <label className="block text-sm font-medium text-foreground">{t('fields.title')} <span className="text-destructive">*</span></label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onScanQr}
                  title={t('actions.scanQr') as string}
                  className="flex items-center gap-1"
                >
                  <span>{t('actions.scanQr')}</span>
                  <Icon name="scan" size={16} className="ml-1" />
                </Button>
              </div>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('fields.title') as string}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.username')}</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder={t('fields.username') as string}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.password')}</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={otpActive ? currentOtpCode : formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={t('fields.password') as string}
                  type={showPassword ? 'text' : 'password'}
                  className="flex-1 min-w-0"
                
                />
                {otpActive && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {t('otp.refreshIn', { seconds: otpSecondsLeft })}
                  </span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPassword(v => !v)}
                  title={showPassword ? 'Hide' : 'View'}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  {showPassword ? (
                    <Icon name="eye-off" size={16} />
                  ) : (
                    <Icon name="eye" size={16} />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
                    const password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
                    setFormData(prev => ({ ...prev, password }))
                  }}
                  title={t('actions.generatePassword') as string}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  <Icon name="rotate-ccw" size={16} />
                </Button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.url')}</label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com"
                type="url"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.tags')}</label>
              <TagInput
                value={formData.tags || []}
                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                suggestions={(() => { try { return JSON.parse(localStorage.getItem('knownTags') || '[]') } catch { return [] } })()}
                placeholder={t('fields.tags') as string}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('fields.notes') as string}
                className="w-full min-h-[100px] px-3 py-2 bg-background border border-input rounded-lg text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent transition-all duration-200 resize-vertical"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {editingPassword ? t('actions.update') : t('actions.create')}
                </span>
              ) : (
                editingPassword ? t('actions.update') : t('actions.create')
              )}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
              {t('actions.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}


