import React from 'react'
import { Shell } from '../components/layout/Shell'
import { useTranslation } from 'react-i18next'
import { MasterGate } from '../features/security/MasterGate'

export function Vault(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <MasterGate>
      <Shell>
        <h1 className="text-2xl font-bold">{t('vault.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('vault.empty')}</p>
      </Shell>
    </MasterGate>
  )
}


