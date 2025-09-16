import React from 'react'
import type { VaultItem } from '../../services/vaultApi'
import { Input } from '../../components/ui/input'
import { Icon } from '../../components/ui/icon'
import { useTranslation } from 'react-i18next'

export type PasswordListPaneProps = {
  passwords: VaultItem[]
  isFetching: boolean
  isSsoMissingOrExpired: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  onAdd: () => void
  width: number
}

export function PasswordListPane(props: PasswordListPaneProps): React.JSX.Element {
  const { t } = useTranslation()
  const { passwords, isFetching, isSsoMissingOrExpired, selectedId, onSelect, search, onSearchChange, onAdd, width } = props

  return (
    <div className="bg-card border-r border-border flex flex-col min-h-0" style={{ width }}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground">{t('nav.passwords')}</h1>
          <button
            className="h-9 w-9 bg-primary hover:bg-primary-hover rounded-lg flex items-center justify-center transition-colors"
            title={t('actions.add') as string}
            onClick={onAdd}
          >
            <Icon name="plus" size={16} className="text-primary-foreground" />
          </button>
        </div>
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder') as string}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted/50 border-0 focus:bg-background"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-1">
          {isFetching && (
            <div className="py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}
          {!isFetching && passwords.length === 0 && (
            <div className="py-10">
              <div className={`text-center text-sm ${isSsoMissingOrExpired ? 'text-destructive' : 'text-muted-foreground'}`}>{isSsoMissingOrExpired ? t('team.ssoLoginCta') : t('vault.empty')}</div>
            </div>
          )}
          {!isFetching && passwords.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`
                w-full text-left p-3 rounded-lg transition-all duration-200 group
                ${selectedId === p.id
                  ? 'bg-primary/10 border border-primary/20 shadow-sm'
                  : 'hover:bg-muted/50 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedId === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon name="lock" size={12} className="flex-shrink-0" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate group-hover:text-foreground flex items-center gap-2">
                    <span className="truncate">{p.title}</span>
                    {typeof p.notes === 'string' && p.notes.startsWith('otp:') && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">OTP</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {p.username}
                  </div>
                  {p.url && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {new URL(p.url).hostname}
                    </div>
                  )}
                </div>

                {selectedId === p.id && (
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}


