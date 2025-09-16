import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { resolveVaultContext } from '../services/vaultPaths'
import { PasswordListPane } from './passwords/PasswordListPane'
import { PasswordForm, type PasswordFormData } from './passwords/PasswordForm'
import { PasswordDetails } from './passwords/PasswordDetails'
import { generateTotp, parseOtpMetaFromItem } from '../lib/otp'
import { mergeKnownTags, dedupeTags } from '../lib/tags'

function Content(): React.JSX.Element {
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
  const awsProfile = useSelector((s: RootState) => s.ui.awsProfile)
  const awsAccountId = useSelector((s: RootState) => s.ui.awsAccountId)
  const storageMode = useSelector((s: RootState) => s.ui.storageMode)
  const ssoRequired = useSelector((s: RootState) => s.ui.ssoRequired)
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true })
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
    return passwords.find(x => x.id === selectedId) ?? null
  }, [passwords, selectedId])

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
        const secret = await (window as any).cloudpass?.teamGetSecretValue?.(awsRegion || region, selectedItem.ssmArn, awsProfile || profile)
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
  }, [selectedItem, selectedItem?.id, selectedItem?.ssmArn, storageMode, uid, key, selectedVaultId, email, awsRegion, awsProfile])

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

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPassword, setEditingPassword] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null}>({isOpen: false, item: null})
  const [formData, setFormData] = useState<PasswordFormData>({ title: '', username: '', password: '', url: '', notes: '', tags: [] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanCopied, setScanCopied] = useState(false)
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState<{w: number; h: number}>({ w: 0, h: 0 })
  const [displaySize, setDisplaySize] = useState<{w: number; h: number}>({ w: 0, h: 0 })
  const [selection, setSelection] = useState<{x: number; y: number; w: number; h: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number; y: number} | null>(null)
  // OTP helpers moved to lib/otp
  const clearAwsAccountContext = useCallback(() => {
    try { localStorage.removeItem('awsAccountId') } catch {}
    try { void (window as any).cloudpass?.storeSet?.('awsAccountId', '') } catch {}
    try { dispatch(setAwsAccountId('')) } catch {}
  }, [dispatch])

  useEffect(() => {
    if (!error) return
    const msg = String((error as any)?.error ?? (error as any)?.data?.error ?? (error as any)?.message ?? '')
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
      if ((window as any).cloudpass?.storeSet) {
        void (window as any).cloudpass.storeSet('listPaneWidth', String(listWidth))
      }
      document.body.style.cursor = ''
      ;(document.body.style as any).userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    ;(document.body.style as any).userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      ;(document.body.style as any).userSelect = ''
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
        const codeNow = generateTotp(secret, { digits, algorithm: algLower as any, step, epoch: Date.now() })
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

  async function handleSelectImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      setQrDataUrl(url)
      loadPreview(url)
    }
    reader.readAsDataURL(file)
  }

  async function handleCaptureScreen() {
    try {
      const dataUrl = await (window as any).cloudpass.captureScreen()
      if (dataUrl) {
        setQrDataUrl(dataUrl)
        loadPreview(dataUrl)
      }
    } catch {}
  }

  function loadPreview(url: string) {
    const img = new Image()
    img.onload = () => {
      setImageElement(img)
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      const maxWidth = 640
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      setDisplaySize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) })
      setSelection(null)
      drawCanvas(img, null)
    }
    img.src = url
  }

  function drawCanvas(img: HTMLImageElement, sel: {x: number; y: number; w: number; h: number} | null) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = displaySize.w || 640
    canvas.height = displaySize.h || Math.max(360, Math.round((displaySize.w || 640) * 0.6))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (sel) {
      ctx.save()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(sel.x, sel.y, sel.w, sel.h)
      ctx.restore()
    }
  }

  async function decodeFromDataUrl(dataUrl: string): Promise<void> {
    try {
      // Try jsQR at multiple scales
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = dataUrl })
      const tryDecode = (canvas: HTMLCanvasElement): string | null => {
        const ctx = canvas.getContext('2d')!
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const res = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' as any })
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
            const codeNow = generateTotp(secret, { digits, algorithm: algLower as any, step, epoch: Date.now() })
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
        setScanCopied(true)
        showToast(t('clipboard.secretCopied') as string, 'success')
      } else {
        setFormData(prev => ({ ...prev, password: text }))
        setScanCopied(true)
        showToast(t('clipboard.passwordCopied') as string, 'success')
      }
    } catch {
      showToast(t('qr.noQrFound') as string, 'error')
    }
  }

  function beginDrag(ev: React.MouseEvent<HTMLCanvasElement>) {
    const rect = ev.currentTarget.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    setDragStart({ x, y })
    setSelection({ x, y, w: 0, h: 0 })
  }

  function onDrag(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart || !imageElement) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    const sel = {
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y),
    }
    setSelection(sel)
    drawCanvas(imageElement, sel)
  }

  function endDrag() {
    setDragStart(null)
  }

  function resetSelection() {
    if (imageElement) {
      setSelection(null)
      drawCanvas(imageElement, null)
    }
  }

  async function scanSelectedArea() {
    if (!imageElement || !canvasRef.current) return
    try {
      setIsScanning(true)
      const canvas = document.createElement('canvas')
      const scaleX = naturalSize.w / (displaySize.w || 1)
      const scaleY = naturalSize.h / (displaySize.h || 1)
      const sel = selection || { x: 0, y: 0, w: displaySize.w, h: displaySize.h }
      const crop = {
        x: Math.max(0, Math.floor(sel.x * scaleX)),
        y: Math.max(0, Math.floor(sel.y * scaleY)),
        w: Math.max(1, Math.floor(sel.w * scaleX)),
        h: Math.max(1, Math.floor(sel.h * scaleY)),
      }
      canvas.width = crop.w
      canvas.height = crop.h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(imageElement, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
      const imgData = ctx.getImageData(0, 0, crop.w, crop.h)
      const code = jsQR(imgData.data, imgData.width, imgData.height)
      if (!code || !code.data) {
        showToast(t('qr.noQrFound') as string, 'error')
        return
      }
      const text = code.data
      if (text.toLowerCase().startsWith('otpauth://')) {
        const match = text.match(/[?&]secret=([^&]+)/i)
        const secret = match ? decodeURIComponent(match[1]) : ''
        const isTotp = text.toLowerCase().startsWith('otpauth://totp')
        const digitsMatch = text.match(/[?&]digits=(\d+)/i)
        const algoMatch = text.match(/[?&]algorithm=([^&]+)/i)
        const periodMatch = text.match(/[?&](period|step)=(\d+)/i)
        const digits = digitsMatch ? Math.max(6, parseInt(digitsMatch[1], 10) || 6) : 6
        const algorithm = (algoMatch ? (algoMatch[1] || 'SHA1') : 'SHA1').toUpperCase()
        const step = periodMatch ? (parseInt(periodMatch[2] || periodMatch[1], 10) || 30) : 30
        if (isTotp) {
          // Persist metadata and original URL in notes; keep password as original URL
          setFormData(prev => ({
            ...prev,
            password: text,
            notes: `otp:secret=${encodeURIComponent(secret)};digits=${digits};algorithm=${algorithm};step=${step};otpurl=${encodeURIComponent(text)}`,
          }))
          otpConfigRef.current = { secret, digits, algorithm, step }
          setOtpActive(true)
          const compute = () => {
            if (!otpConfigRef.current) return
            const { secret, digits, algorithm, step } = otpConfigRef.current
            const algLower = (algorithm || 'SHA1').toLowerCase()
            try {
              const codeNow = generateTotp(secret, { digits, algorithm: algLower as any, step, epoch: Date.now() })
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
          setScanCopied(true)
          showToast(t('clipboard.secretCopied') as string, 'success')
        } else {
          setFormData(prev => ({ ...prev, password: secret }))
          setScanCopied(true)
          showToast(t('clipboard.secretCopied') as string, 'success')
        }
      } else {
        setFormData(prev => ({ ...prev, password: text }))
        setScanCopied(true)
        showToast(t('clipboard.passwordCopied') as string, 'success')
      }
    } catch {
      showToast(t('qr.noQrFound') as string, 'error')
    } finally {
      setIsScanning(false)
    }
  }

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
        const pr: any = _updateItem({ uid, key, item: { ...item, id: editingPassword.id }, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
        await (pr?.unwrap ? pr.unwrap() : pr)
      } else {
        const pr: any = _createItem({ uid, key, item, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
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
    setDeleteConfirm({isOpen: true, item})
  }

  async function handleDeleteConfirm() {
    if (deleteConfirm.item && uid && key) {
      try {
        setIsDeleting(true)
        {
          const pr: any = removeItem({ uid, key, id: deleteConfirm.item.id, selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId })
          await (pr?.unwrap ? pr.unwrap() : pr)
        }
        setDeleteConfirm({isOpen: false, item: null})
        if (selectedId === deleteConfirm.item.id) {
          dispatch(setSelectedItemId(null))
        }
      } catch (e: any) {
        const msg = String(e?.data?.error ?? e?.error ?? e?.message ?? '')
        if (msg.toLowerCase().includes('token is expired') || msg.toLowerCase().includes('sso')) {
          clearAwsAccountContext()
          showToast(t('team.ssoExpiredInline') as string, 'error')
        } else {
          showToast(t('team.listFailed') as string, 'error')
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

      <div className="flex-1 bg-background min-w-0">
        {showCreateForm ? (
          <PasswordForm
            isSubmitting={isSubmitting}
            editingPassword={editingPassword}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            scanCopied={scanCopied}
            onScanQr={async () => {
                          try {
                            const dataUrl: string | null = await (window as any).cloudpass.cropScreen()
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
            const base = passwords.find(x => x.id === selectedId)
            const p = base ? ({
              ...base,
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
                const secret = await (window as any).cloudpass.teamGetSecretValue(awsRegion || region, p.ssmArn, awsProfile || profile)
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
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title={t('actions.confirmDelete')}
        message={t('actions.deleteMessage', { name: deleteConfirm.item?.title })}
        confirmText={t('actions.delete')}
        cancelText={t('actions.cancel')}
        variant="destructive"
        loading={isDeleting}
      />
      {false && (showQrModal || qrDataUrl) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-xl w-[720px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="text-lg font-semibold">{t('qr.title')}</div>
              <button className="h-8 px-3 rounded bg-muted" onClick={() => { setShowQrModal(false); setQrDataUrl(null) }}>{t('qr.cancel')}</button>
            </div>
            <div className="p-4 space-y-3 overflow-auto">
              <div className="text-sm text-muted-foreground">{t('qr.instructions')}</div>
              <div className="flex gap-2">
                <label className="h-9 px-3 rounded bg-muted hover:bg-muted/80 inline-flex items-center cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
                  {t('qr.selectImage')}
                </label>
                <button className="h-9 px-3 rounded bg-muted hover:bg-muted/80" onClick={handleCaptureScreen}>{t('qr.captureScreen')}</button>
                <button className="h-9 px-3 rounded bg-muted hover:bg-muted/80" onClick={async () => {
                  try {
                    const dataUrl = await (window as any).cloudpass.captureActiveFrame()
                    if (dataUrl) { setQrDataUrl(dataUrl); loadPreview(dataUrl) }
                  } catch {}
                }}>Capture active</button>
                <button className="h-9 px-3 rounded bg-muted hover:bg-muted/80" onClick={async () => {
                  try {
                    const dataUrl = await (window as any).cloudpass.captureViaPicker()
                    if (dataUrl) { setQrDataUrl(dataUrl); loadPreview(dataUrl) }
                  } catch {}
                }}>Capture via picker</button>
                <button className="h-9 px-3 rounded bg-primary text-primary-foreground disabled:opacity-50" disabled={!qrDataUrl || isScanning} onClick={scanSelectedArea}>
                  {isScanning ? t('team.loading') : t('qr.scan')}
                </button>
                <button className="h-9 px-3 rounded bg-muted hover:bg-muted/80 disabled:opacity-50" disabled={!selection} onClick={resetSelection}>{t('qr.cropReset')}</button>
              </div>
              <div className="border border-border rounded-lg p-2 overflow-auto">
                <div className="flex items-start gap-4">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full cursor-crosshair"
                    width={displaySize.w || 640}
                    height={displaySize.h || 360}
                    onMouseDown={beginDrag}
                    onMouseMove={onDrag}
                    onMouseUp={endDrag}
                  />
                  {qrDataUrl && (
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-xs text-muted-foreground mb-1">Captured</div>
                      <img src={qrDataUrl || undefined} alt="Captured" className="max-w-full rounded border border-border" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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


