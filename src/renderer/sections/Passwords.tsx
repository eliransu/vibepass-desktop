import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, type VaultItem } from '../services/vaultApi'
import { useUpdateMutation } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import jsQR from 'jsqr'
import { useTranslation } from 'react-i18next'
import { decryptJson } from '../../shared/security/crypto'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Icon } from '../components/ui/icon'
import { copyWithFeedback } from '../lib/clipboard'
import { useSafeToast } from '../hooks/useSafeToast'
import { resolveVaultContext, getVaultSecretNameWithOverrides } from '../services/vaultPaths'
import { PasswordListPane } from './passwords/PasswordListPane'
import { PasswordForm, type PasswordFormData } from './passwords/PasswordForm'
import { PasswordDetails } from './passwords/PasswordDetails'
import { generateTotp, parseOtpMetaFromItem } from '../lib/otp'
import { mergeKnownTags, dedupeTags } from '../lib/tags'

function Content(): React.JSX.Element {
  const location = useLocation()
  const routePreloaded: VaultItem | null = (location?.state?.preloadedItem as VaultItem) || null
  const { t } = useTranslation()
  const { showToast } = useSafeToast()
  const dispatch = useDispatch()
  const user = useSelector((s: RootState) => s.auth.user)
  const key = useSelector((s: RootState) => s.masterKey.key)
  const selectedId = useSelector((s: RootState) => s.ui.selectedItemId)
  const selectedVaultId = useSelector((s: RootState) => s.ui.selectedVaultId)
  const search = useSelector((s: RootState) => s.ui.searchQuery)
  const uid = user?.uid ?? ''
  const email = user?.email ?? ''
  const awsRegion = useSelector((s: RootState) => s.ui.awsRegion)
  // AWS profile is no longer used; SSO JSON config provides context
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const ssoRequired = useSelector((s: RootState) => s.ui.ssoRequired)
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, accountIdOverride: awsAccountId }, { skip: !uid || !key, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true })
  const isSsoMissingOrExpired = storageMode === 'cloud' && (!!ssoRequired || !awsAccountId)
  const [_createItem] = useCreateMutation()
  const [_updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()

  const passwords = useMemo(() => {
    const list = (data ?? []).filter(i => (i.category ?? 'passwords') === 'passwords')
    if (!search) return list
    const q = search.toLowerCase().trim().replace(/^#/, '')
    return list.filter(i => {
      const inTitle = (i.title || '').toLowerCase().includes(q)
      const inUser = (i.username || '').toLowerCase().includes(q)
      const inTags = Array.isArray(i.tags) && i.tags.some(tag => tag.toLowerCase().replace(/^#/, '').includes(q))
      return inTitle || inUser || inTags
    })
  }, [data, search])

  const selectedItem = useMemo(() => {
    if (!selectedId) return null
    const fromList = passwords.find(x => x.id === selectedId) ?? null
    if (routePreloaded && routePreloaded.id === selectedId) return routePreloaded
    return fromList
  }, [passwords, selectedId, routePreloaded])

  // Ensure selection is set from route preloaded item immediately upon navigation
  useEffect(() => {
    if (routePreloaded && routePreloaded.id && selectedId !== routePreloaded.id) {
      try { dispatch(setSelectedItemId(routePreloaded.id)) } catch {}
    }
  }, [routePreloaded, routePreloaded?.id, selectedId, dispatch])

  // Resolve freshest value from remote when in cloud mode
  const [resolvedItem, setResolvedItem] = useState<VaultItem | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadRemote(): Promise<void> {
      try {
        if (!selectedItem || storageMode !== 'cloud' || !selectedItem.ssmArn || !uid || !key) {
          setResolvedItem(null)
          return
        }
        const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion })
        const secret = await window.cloudpass?.teamGetSecretValue?.({ region: awsRegion || region, secretId: selectedItem.ssmArn, profile })
        if (cancelled) return
        if (secret) {
          try {
            const decrypted = decryptJson<VaultItem>(secret, key)
            setResolvedItem({ ...decrypted, id: selectedItem.id, ssmArn: selectedItem.ssmArn })
          } catch {
            setResolvedItem(null)
          }
        } else {
          setResolvedItem(null)
        }
      } catch {
        setResolvedItem(null)
      }
    }
    void loadRemote()
    return () => { cancelled = true }
  }, [selectedItem, selectedItem?.id, selectedItem?.ssmArn, storageMode, uid, key, selectedVaultId, email, awsRegion])

  // Fallback: when navigating from command palette in cloud mode,
  // fetch the consolidated vault directly to resolve the selected item
  useEffect(() => {
    let cancelled = false
    async function loadDirectFromVault(): Promise<void> {
      try {
        if (!selectedId || storageMode !== 'cloud' || !uid || !key) return
        if (!awsRegion || !awsAccountId) return
        // If we already have the base item, no need for fallback
        if (selectedItem) return
        const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, email, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        const res = await window.cloudpass?.vaultRead?.({ region: String(awsRegion || region), name: String(name), profile })
        if (cancelled) return
        if (!res || res.success !== true) return
        const secret = res.data ?? ''
        let parsed: Record<string, VaultItem> = {}
        try {
          parsed = selectedVaultId === 'work' ? (JSON.parse(secret) as Record<string, VaultItem>) : decryptJson<Record<string, VaultItem>>(secret, key || '')
        } catch {
          try { parsed = JSON.parse(secret) as Record<string, VaultItem> } catch { parsed = {} }
        }
        const found = parsed[selectedId]
        if (found) {
          setResolvedItem({ ...found })
        }
      } catch {}
    }
    void loadDirectFromVault()
    return () => { cancelled = true }
  }, [selectedId, selectedItem, storageMode, uid, key, selectedVaultId, email, awsRegion, awsAccountId])

  // Reset local UI state immediately when storage mode changes
  useEffect(() => {
    try {
      setShowCreateForm(false)
      setEditingPassword(null)
      setResolvedItem(null)
      dispatch(setSelectedItemId(null))
      dispatch(setSearchQuery(''))
    } catch {}
  }, [storageMode, dispatch])

  // When selection changes via command palette, mimic list item click side-effects
  useEffect(() => {
    if (!selectedId) return
    try {
      setShowCreateForm(false)
      setEditingPassword(null)
    } catch {}
  }, [selectedId])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPassword, setEditingPassword] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null, vaultId: string | null}>({isOpen: false, item: null, vaultId: null})
  const [formData, setFormData] = useState<PasswordFormData>({ title: '', username: '', password: '', url: '', notes: '', tags: [] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // QR modal and manual scanning removed in favor of native crop
  const [otpSecondsLeft, setOtpSecondsLeft] = useState<number>(0)
  const [otpActive, setOtpActive] = useState<boolean>(false)
  const [currentOtpCode, setCurrentOtpCode] = useState<string>('')
  const otpTimerRef = useRef<number | null>(null)
  const otpConfigRef = useRef<{ secret: string; digits: number; algorithm: string; step: number } | null>(null)
  // Detail view OTP runtime state
  const [detailOtpCode, setDetailOtpCode] = useState<string>('')
  const [detailOtpSecondsLeft, setDetailOtpSecondsLeft] = useState<number>(0)
  const detailOtpTimerRef = useRef<number | null>(null)
  const detailOtpConfigRef = useRef<{ secret: string; digits: number; algorithm: string; step: number } | null>(null)
  // Manual canvas selection state removed
  // OTP helpers moved to lib/otp
  const clearAwsAccountContext = useCallback(() => {
    try { localStorage.removeItem('awsAccountId') } catch {}
    try { void window.cloudpass?.storeSet?.('awsAccountId', '') } catch {}
    try { dispatch(setAwsAccountId('')) } catch {}
  }, [dispatch])

  useEffect(() => {
    if (!error) return
    const anyErr = error as unknown as { error?: string; data?: { error?: string }; message?: string }
    const msg = String(anyErr?.error ?? anyErr?.data?.error ?? anyErr?.message ?? '')
    if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
      clearAwsAccountContext()
    }
  }, [error, clearAwsAccountContext])


  const containerRef = useRef<HTMLDivElement | null>(null)
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('listPaneWidth')) || ''
    const parsed = parseInt(saved, 10)
    return Number.isFinite(parsed) && parsed >= 240 && parsed <= 600 ? parsed : 320
  })
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return
    const onMove = (e: MouseEvent) => {
      const left = containerRef.current?.getBoundingClientRect().left ?? 0
      const raw = e.clientX - left
      const clamped = Math.max(240, Math.min(600, raw))
      setListWidth(clamped)
    }
    const onUp = () => {
      setIsResizing(false)
      localStorage.setItem('listPaneWidth', String(listWidth))
      if (window.cloudpass?.storeSet) {
        void window.cloudpass.storeSet('listPaneWidth', String(listWidth))
      }
      document.body.style.cursor = ''
      ;(document.body.style as unknown as { userSelect?: string }).userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    ;(document.body.style as unknown as { userSelect?: string }).userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      ;(document.body.style as unknown as { userSelect?: string }).userSelect = ''
    }
  }, [isResizing, listWidth])

  function resetForm() {
    setFormData({
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
      tags: []
    })
    setShowCreateForm(false)
    setEditingPassword(null)
    setOtpActive(false)
    if (otpTimerRef.current) { window.clearInterval(otpTimerRef.current); otpTimerRef.current = null }
  }

  const selectedOtpMeta = useMemo(() => parseOtpMetaFromItem(resolvedItem ?? selectedItem), [resolvedItem, selectedItem])

  useEffect(() => {
    const meta = selectedOtpMeta
    if (!meta) {
      if (detailOtpTimerRef.current) { window.clearInterval(detailOtpTimerRef.current); detailOtpTimerRef.current = null }
      setDetailOtpCode('')
      setDetailOtpSecondsLeft(0)
      return
    }
    detailOtpConfigRef.current = meta
    const computeDetail = () => {
      if (!detailOtpConfigRef.current) return
      const { secret, digits, algorithm, step } = detailOtpConfigRef.current
      const algLower = (algorithm || 'SHA1').toLowerCase()
      try {
        const codeNow = generateTotp(secret, { digits, algorithm: algLower, step, epoch: Date.now() })
        setDetailOtpCode(codeNow)
        const epoch = Math.floor(Date.now() / 1000)
        let left = step - (epoch % step)
        if (left <= 0 || left > step) left = step
        setDetailOtpSecondsLeft(left)
      } catch {}
    }
    computeDetail()
    if (detailOtpTimerRef.current) window.clearInterval(detailOtpTimerRef.current)
    detailOtpTimerRef.current = window.setInterval(computeDetail, 1000) as unknown as number
    return () => {
      if (detailOtpTimerRef.current) { window.clearInterval(detailOtpTimerRef.current); detailOtpTimerRef.current = null }
    }
  }, [selectedOtpMeta?.secret, selectedOtpMeta?.digits, selectedOtpMeta?.algorithm, selectedOtpMeta?.step, selectedOtpMeta])

  // Deprecated in favor of desktop crop overlay

  // File/select screen capture helpers removed

  // Manual canvas preview removed

  async function decodeFromDataUrl(dataUrl: string): Promise<void> {
    try {
      // Try jsQR at multiple scales
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = dataUrl })
      const tryDecode = (canvas: HTMLCanvasElement): string | null => {
        const ctx = canvas.getContext('2d')!
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const inversionAttempts: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' = 'attemptBoth'
        const res = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts })
        return res?.data || null
      }
      const scales = [1, 1.5, 2, 0.75]
      let decoded: string | null = null
      for (const s of scales) {
        const cw = Math.max(1, Math.floor(img.naturalWidth * s))
        const ch = Math.max(1, Math.floor(img.naturalHeight * s))
        const c = document.createElement('canvas')
        c.width = cw; c.height = ch
        const cctx = c.getContext('2d')!
        cctx.imageSmoothingEnabled = s > 1
        cctx.drawImage(img, 0, 0, cw, ch)
        decoded = tryDecode(c)
        if (decoded) break
      }
      if (!decoded) {
        // Fallback: ZXing
        try {
          const zxing = await import('@zxing/library')
          const reader = new zxing.BrowserQRCodeReader()
          const res = await reader.decodeFromImageUrl(dataUrl)
          decoded = res?.getText?.() || null
        } catch {}
      }
      if (!decoded) {
        showToast(t('qr.noQrFound') as string, 'error')
        return
      }
      const text = String(decoded || '')
      if (text.toLowerCase().startsWith('otpauth://')) {
        // Parse label to title
        let label = ''
        try {
          const path = text.split('://')[1] || ''
          const afterKind = path.substring(path.indexOf('/') + 1)
          label = decodeURIComponent(afterKind.split('?')[0] || '').replace(/\+/g, ' ')
        } catch {}
        const match = text.match(/[?&]secret=([^&]+)/i)
        const secret = match ? decodeURIComponent(match[1]) : ''
        const digitsMatch = text.match(/[?&]digits=(\d+)/i)
        const algoMatch = text.match(/[?&]algorithm=([^&]+)/i)
        const periodMatch = text.match(/[?&](period|step)=(\d+)/i)
        const digits = digitsMatch ? Math.max(6, parseInt(digitsMatch[1], 10) || 6) : 6
        const algorithm = (algoMatch ? (algoMatch[1] || 'SHA1') : 'SHA1').toUpperCase()
        const step = periodMatch ? (parseInt(periodMatch[2] || periodMatch[1], 10) || 30) : 30
        // Store OTP metadata and original URL in notes; keep password as original URL
        setFormData(prev => ({
          ...prev,
          title: prev.title?.trim().length ? prev.title : (label || t('nav.passwords') as string),
          password: text,
          notes: `otp:secret=${encodeURIComponent(secret)};digits=${digits};algorithm=${algorithm};step=${step};otpurl=${encodeURIComponent(text)}`,
        }))
        // Live TOTP code updates
        otpConfigRef.current = { secret, digits, algorithm, step }
        setOtpActive(true)
        setShowPassword(true)
        const compute = () => {
          if (!otpConfigRef.current) return
          const { secret, digits, algorithm, step } = otpConfigRef.current
          const algLower = (algorithm || 'SHA1').toLowerCase()
          try {
            const codeNow = generateTotp(secret, { digits, algorithm: algLower, step, epoch: Date.now() })
            setCurrentOtpCode(codeNow)
            const epoch = Math.floor(Date.now() / 1000)
            let left = step - (epoch % step)
            if (left <= 0 || left > step) left = step
            setOtpSecondsLeft(left)
          } catch {}
        }
        compute()
        if (otpTimerRef.current) window.clearInterval(otpTimerRef.current)
        otpTimerRef.current = window.setInterval(compute, 1000) as unknown as number
        // notify via toast only
        showToast(t('clipboard.secretCopied') as string, 'success')
      } else {
        setFormData(prev => ({ ...prev, password: text }))
        // notify via toast only
        showToast(t('clipboard.passwordCopied') as string, 'success')
      }
    } catch {
      showToast(t('qr.noQrFound') as string, 'error')
    }
  }

  // Manual selection handlers removed

  // Removed manual scanSelectedArea UI; cropScreen + decodeFromDataUrl path is used instead

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uid || !key || !formData.title) return
    
    const item: VaultItem = { 
      id: editingPassword?.id || '', 
      title: formData.title, 
      username: formData.username,
      password: formData.password,
      url: formData.url,
      notes: formData.notes,
      tags: dedupeTags(formData.tags || []),
      category: 'passwords' 
    }
    try {
      setIsSubmitting(true)
      if (editingPassword) {
          const pr: any = _updateItem({ uid, key, item: { ...item, id: editingPassword.id }, selectedVaultId, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      } else {
        const pr: any = _createItem({ uid, key, item, selectedVaultId, regionOverride: awsRegion, accountIdOverride: awsAccountId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      }
      try { mergeKnownTags(item.tags || []) } catch {}
      resetForm()
    } catch (e: any) {
      const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
      if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
        clearAwsAccountContext()
        showToast(t('team.ssoExpiredInline') as string, 'error')
      } else {
        showToast(t('team.createFailed') as string, 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(password: VaultItem) {
    setFormData({
      title: password.title,
      username: password.username || '',
      password: password.password || '',
      url: password.url || '',
      notes: password.notes || '',
      tags: Array.isArray(password.tags) ? password.tags : []
    })
    setEditingPassword(password)
    setShowCreateForm(true)
  }

  function handleDeleteClick(item: VaultItem) {
    setDeleteConfirm({isOpen: true, item, vaultId: selectedVaultId || null})
  }

  async function handleDeleteConfirm() {
    console.log({deleteConfirm,uid,key})
    if (deleteConfirm.item && uid && key) {
      try {
        setIsDeleting(true)
        {
          const pr: any = removeItem({ uid, key, id: deleteConfirm.item.id, selectedVaultId: deleteConfirm.vaultId || selectedVaultId, regionOverride: awsRegion, accountIdOverride: awsAccountId })
          await (pr?.unwrap ? pr.unwrap() : pr)
        }
        setDeleteConfirm({isOpen: false, item: null, vaultId: null})
        if (selectedId === deleteConfirm.item.id) {
          dispatch(setSelectedItemId(null))
        }
      } catch (e: any) {
        const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
        if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
          clearAwsAccountContext()
          showToast(t('team.ssoExpiredInline') as string, 'error')
        } else {
          showToast(t('team.deleteFailed') as string, 'error')
        }
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <div className="h-full min-h-0 flex" ref={containerRef}>
      <PasswordListPane
        passwords={passwords}
        isFetching={isFetching}
        isSsoMissingOrExpired={isSsoMissingOrExpired}
        selectedId={selectedId}
        onSelect={(id) => { try { resetForm() } catch {}; dispatch(setSelectedItemId(id)) }}
        search={search}
        onSearchChange={(v) => dispatch(setSearchQuery(v))}
        onAdd={() => setShowCreateForm(true)}
        width={listWidth}
      />

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => setIsResizing(true)}
        className={`w-1 cursor-col-resize bg-transparent hover:bg-border active:bg-border`} 
      />

      <div className="flex-1 bg-background min-h-0 min-w-0">
        {showCreateForm ? (
          <PasswordForm
            isSubmitting={isSubmitting}
            editingPassword={editingPassword}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            onScanQr={async () => {
                          try {
                            const dataUrl: string | null = await window.cloudpass.cropScreen()
                            if (!dataUrl) return
                            await decodeFromDataUrl(dataUrl)
                          } catch {}
                        }}
            otpActive={otpActive}
            currentOtpCode={currentOtpCode}
            otpSecondsLeft={otpSecondsLeft}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
        ) : selectedId ? (
          (() => {
            const base = passwords.find(x => x.id === selectedId) || null
            const p = (resolvedItem || base) ? ({
              ...(base || {}),
              ...(resolvedItem || {}),
            } as VaultItem) : null
            if (!p) return (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground">{t('vault.empty')}</div>
                </div>
              </div>
            )
            const otpMeta = selectedOtpMeta
            const handleCopy = async (): Promise<void> => {
              try {
                            if (typeof p.notes === 'string' && p.notes.startsWith('otp:')) {
                              const code = detailOtpCode || ''
                              await copyWithFeedback(code, t('clipboard.passwordCopied'), showToast)
                              return
                            }
                            if (!p.ssmArn) {
                              if (p.password && p.password.toLowerCase().startsWith('otpauth://')) {
                                await copyWithFeedback(detailOtpCode || '', t('clipboard.passwordCopied'), showToast)
                                return
                              }
                              await copyWithFeedback(p.password ?? '', t('clipboard.passwordCopied'), showToast)
                              return
                            }
                              const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion })
                const secret = await window.cloudpass.teamGetSecretValue({ region: awsRegion || region, secretId: p.ssmArn, profile })
                              if (secret) {
                                const decrypted = decryptJson<VaultItem>(secret, key ?? '')
                                const value = decrypted.password || ''
                                if (value.toLowerCase().startsWith('otpauth://')) {
                                  await copyWithFeedback(detailOtpCode || '', t('clipboard.passwordCopied'), showToast)
                                } else {
                                  await copyWithFeedback(value, t('clipboard.passwordCopied'), showToast)
                                }
                              }
                            } catch {
                              await copyWithFeedback(p.password ?? '', t('clipboard.passwordCopied'), showToast)
                            }
            }
            return (
              <PasswordDetails
                item={p}
                otpMeta={otpMeta}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                detailOtpCode={detailOtpCode}
                detailOtpSecondsLeft={detailOtpSecondsLeft}
                onEdit={startEdit}
                onDelete={handleDeleteClick}
                onCopyPassword={handleCopy}
              />
            )
          })()
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="lock" size={12} className="flex-shrink-0" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">{t('search.select')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t('vault.selectDescription')}
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">{navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}</kbd>
                +<kbd className="px-1.5 py-0.5 rounded border border-border bg-muted">K</kbd> to search any key by name or #tag.
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null, vaultId: null })}
        onConfirm={handleDeleteConfirm}
        title={t('actions.confirmDelete')}
        message={t('actions.deleteMessage', { name: deleteConfirm.item?.title })}
        confirmText={t('actions.delete')}
        cancelText={t('actions.cancel')}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  )
}

export function Passwords(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


