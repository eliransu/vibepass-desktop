import React from 'react'
import type { VaultItem } from '../../services/vaultApi'
import { Button } from '../../components/ui/button'
import { Icon } from '../../components/ui/icon'
import { useTranslation } from 'react-i18next'
import { copyWithFeedback } from '../../lib/clipboard'
import { getTagColorClass } from '../../lib/tags'

export type PasswordDetailsProps = {
  item: VaultItem
  otpMeta: { secret: string; digits: number; algorithm: string; step: number } | null
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  detailOtpCode: string
  detailOtpSecondsLeft: number
  onEdit: (item: VaultItem) => void
  onDelete: (item: VaultItem) => void
  onCopyPassword: () => Promise<void>
}

export function PasswordDetails(props: PasswordDetailsProps): React.JSX.Element {
  const { t } = useTranslation()
  const { item: p, otpMeta, showPassword, setShowPassword, detailOtpCode, detailOtpSecondsLeft, onEdit, onDelete, onCopyPassword } = props

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Icon name="lock" size={12} className="flex-shrink-0" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <span className="truncate">{p.title}</span>
                {otpMeta && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">OTP</span>
                )}
              </h2>
              <div className="text-sm text-muted-foreground">{p.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => onEdit(p)}>
              {t('actions.edit')}
            </Button>
            <Button variant="destructive" onClick={() => onDelete(p)}>
              {t('actions.delete')}
            </Button>
          </div>
        </div>
        {p.tags && p.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            {p.tags.map(tag => {
              const color = getTagColorClass(tag)
              return (
                <span key={tag} className={`px-2 py-1 rounded-md text-xs font-medium border ${color}`}>
                  {tag}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
            <div className="h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{p.title}</div>
          </div>
          {p.username && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.username')}</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm min-w-0">{p.username}</div>
                <button
                  className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
                  onClick={() => copyWithFeedback(p.username || '', t('clipboard.usernameCopied'), () => {})}
                  title={t('actions.copy') as string}
                >
                  {t('actions.copy')}
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('fields.password')}</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center font-mono text-sm min-w-0">
                {otpMeta ? (
                  <span className="flex items-center gap-2">
                    <span>{showPassword ? detailOtpCode : '••••••'}</span>
                    <span className="text-xs text-muted-foreground">{t('otp.refreshIn', { seconds: detailOtpSecondsLeft })}</span>
                  </span>
                ) : (p.password && p.password.toLowerCase().startsWith('otpauth://') ? '••••••••' : showPassword ? p.password : '•'.repeat(12))}
              </div>
              <button
                className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground flex-shrink-0 whitespace-nowrap"
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? (
                  <Icon name="eye-off" size={16} />
                ) : (
                  <Icon name="eye" size={16} />
                )}
              </button>
              <button
                className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground flex-shrink-0 whitespace-nowrap"
                onClick={() => { void onCopyPassword() }}
                title={t('actions.copy') as string}
              >
                <Icon name="copy" size={16} />
              </button>
            </div>
          </div>
          {p.url && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.url')}</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm truncate min-w-0">{p.url}</div>
                <button
                  className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
                  onClick={() => window.open(p.url!, '_blank')}
                  title={t('actions.open') as string}
                >
                  {t('actions.open')}
                </button>
              </div>
            </div>
          )}
          {p.notes && !(typeof p.notes === 'string' && p.notes.startsWith('otp:')) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
              <div className="w-full px-3 py-2 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">{p.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


