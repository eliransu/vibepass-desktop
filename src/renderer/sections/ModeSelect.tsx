import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setStorageMode } from '../features/ui/uiSlice'

export function ModeSelect(): React.JSX.Element {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [step, setStep] = React.useState<number>(0)

  function onChoose(mode: 'cloud' | 'local'): void {
    dispatch(setStorageMode(mode))
    navigate('/passwords', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg border rounded-2xl shadow-xl bg-background p-6">
        {step === 0 && (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold">{t('onboarding.welcomeTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('onboarding.welcomeSubtitle')}</p>
            <div className="pt-2">
              <button className="h-11 rounded-lg bg-primary text-primary-foreground px-6 hover:bg-primary/90" onClick={() => setStep(1)}>
                {t('onboarding.next')}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center">{t('onboarding.aboutTitle')}</h2>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t('onboarding.aboutPoint1')}</li>
              <li>{t('onboarding.aboutPoint2')}</li>
              <li>{t('onboarding.aboutPoint3')}</li>
            </ul>
            <div className="rounded-lg border p-3 bg-muted/30 text-xs text-muted-foreground">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">{navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}</kbd>
              +<kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">K</kbd> to search any item by name or #tag from anywhere.
            </div>
            <div className="flex items-center justify-between pt-2">
              <button className="h-10 px-4 rounded-lg border hover:bg-muted" onClick={() => setStep(0)}>{t('onboarding.back')}</button>
              <button className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setStep(2)}>{t('onboarding.next')}</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">{t('onboarding.chooseModeTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('mode.subtitle')}</p>
            </div>
            <div className="grid gap-3">
              <button onClick={() => onChoose('cloud')} className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                {t('mode.cloud')}
              </button>
              <button onClick={() => onChoose('local')} className="h-11 rounded-lg border hover:bg-muted">
                {t('mode.local')}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button className="h-10 px-4 rounded-lg border hover:bg-muted" onClick={() => setStep(1)}>{t('onboarding.back')}</button>
              <button className="h-10 px-4 rounded-lg" onClick={() => setStep(3)}>{t('onboarding.skip')}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">{t('onboarding.letsGoTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.letsGoSubtitle')}</p>
            <div className="grid gap-3 pt-2">
              <button onClick={() => onChoose('cloud')} className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                {t('mode.cloud')}
              </button>
              <button onClick={() => onChoose('local')} className="h-11 rounded-lg border hover:bg-muted">
                {t('mode.local')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


