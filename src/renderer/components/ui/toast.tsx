import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: string; title: string; description?: string }

const Ctx = createContext<{
  toasts: Toast[]
  show: (t: Omit<Toast, 'id'>) => void
  remove: (id: string) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((arr) => [...arr, { id, ...t }])
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 3000)
  }, [])
  const remove = useCallback((id: string) => setToasts((arr) => arr.filter((x) => x.id !== id)), [])
  const value = useMemo(() => ({ toasts, show, remove }), [toasts, show, remove])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 inset-x-0 flex justify-center pointer-events-none">
        <div className="space-y-2 w-full max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto rounded border bg-background p-3 shadow">
              <div className="font-medium">{t.title}</div>
              {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): { show: (t: Omit<Toast, 'id'>) => void } {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('ToastProvider missing')
  return { show: ctx.show }
}


