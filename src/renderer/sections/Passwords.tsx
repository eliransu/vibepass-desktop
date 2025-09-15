import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../shared/store'
import { useListQuery, useCreateMutation, useRemoveMutation, type VaultItem } from '../services/vaultApi'
import { useUpdateMutation } from '../services/vaultApi'
import { MasterGate } from '../features/security/MasterGate'
import jsQR from 'jsqr'
import { HashAlgorithms, KeyEncodings } from '@otplib/core'
import { createDigest } from '@otplib/plugin-crypto-js'
import { useTranslation } from 'react-i18next'
import { decryptJson } from '../../shared/security/crypto'
import { setSelectedItemId, setSearchQuery, setAwsAccountId } from '../features/ui/uiSlice'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Icon } from '../components/ui/icon'
import { copyWithFeedback } from '../lib/clipboard'
import { useSafeToast } from '../hooks/useSafeToast'

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
  const ssoRequired = useSelector((s: RootState) => s.ui.ssoRequired)
  const { data, isFetching, error } = useListQuery({ uid, key: key ?? '', selectedVaultId, regionOverride: awsRegion, profileOverride: awsProfile, accountIdOverride: awsAccountId }, { skip: !uid || !key })
  const isSsoMissingOrExpired = !!ssoRequired || !awsAccountId
  const [_createItem] = useCreateMutation()
  const [_updateItem] = useUpdateMutation()
  const [removeItem] = useRemoveMutation()

  const passwords = useMemo(() => (data ?? [])
    .filter(i => (i.category ?? 'passwords') === 'passwords')
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.username ?? '').toLowerCase().includes(search.toLowerCase()))
  , [data, search])

  const selectedItem = useMemo(() => {
    if (!selectedId) return null
    return passwords.find(x => x.id === selectedId) ?? null
  }, [passwords, selectedId])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPassword, setEditingPassword] = useState<VaultItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, item: VaultItem | null}>({isOpen: false, item: null})
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: ''
  })
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
  // Browser-safe Base32 decoder and createHmacKey for otplib v12
  function base32DecodeToBytes(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const cleaned = (input || '').toUpperCase().replace(/=+|\s+/g, '')
    let buffer = 0
    let bits = 0
    const out: number[] = []
    for (let i = 0; i < cleaned.length; i++) {
      const val = alphabet.indexOf(cleaned[i])
      if (val < 0) continue
      buffer = (buffer << 5) | val
      bits += 5
      if (bits >= 8) {
        bits -= 8
        out.push((buffer >> bits) & 0xff)
      }
    }
    return new Uint8Array(out)
  }
  function bytesToHex(bytes: Uint8Array): string {
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]
      hex += (b < 16 ? '0' : '') + b.toString(16)
    }
    return hex
  }
  const createTotpHmacKey = useCallback((algorithm: HashAlgorithms, secretBase32: string, _encoding: KeyEncodings): string => {
    const raw = base32DecodeToBytes(secretBase32)
    const minBytes = algorithm === HashAlgorithms.SHA1 ? 20 : algorithm === HashAlgorithms.SHA256 ? 32 : 64
    if (raw.length === 0) return ''.padEnd(minBytes * 2, '0')
    let hex = bytesToHex(raw)
    const needed = minBytes * 2
    if (hex.length < needed) {
      const repeat = Math.ceil(needed / hex.length)
      hex = (hex.repeat(repeat)).slice(0, needed)
    } else if (hex.length > needed) {
      hex = hex.slice(0, needed)
    }
    return hex
  }, [])
  function hexToBytes(hex: string): Uint8Array {
    const clean = (hex || '').replace(/[^0-9a-f]/gi, '')
    const len = Math.floor(clean.length / 2)
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16)
    }
    return out
  }
  function padStartStr(value: string, length: number, fill: string): string {
    if (value.length >= length) return value
    return (new Array(length - value.length + 1).join(fill) + value).slice(-length)
  }
  const generateTotp = useCallback((secretBase32: string, opts: { digits: number; algorithm: string; step: number; epoch: number }): string => {
    const digits = opts.digits
    const algLower = String(opts.algorithm || 'sha1').toLowerCase()
    const algorithm = (algLower === 'sha256' ? HashAlgorithms.SHA256 : algLower === 'sha512' ? HashAlgorithms.SHA512 : HashAlgorithms.SHA1)
    const epoch = opts.epoch
    const step = opts.step
    const counter = Math.floor(epoch / step / 1000)
    const hexCounter = padStartStr(counter.toString(16), 16, '0')
    const hmacKeyHex = createTotpHmacKey(algorithm, secretBase32, KeyEncodings.UTF8)
    const hexDigest = createDigest(algorithm, hmacKeyHex, hexCounter)
    const bytes = hexToBytes(hexDigest)
    const offset = bytes[bytes.length - 1] & 0x0f
    const binary = ((bytes[offset] & 0x7f) << 24) | ((bytes[offset + 1] & 0xff) << 16) | ((bytes[offset + 2] & 0xff) << 8) | (bytes[offset + 3] & 0xff)
    const modulo = Math.pow(10, digits)
    const token = String(binary % modulo)
    return padStartStr(token, digits, '0')
  }, [createTotpHmacKey])
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
      notes: ''
    })
    setShowCreateForm(false)
    setEditingPassword(null)
    setOtpActive(false)
    if (otpTimerRef.current) { window.clearInterval(otpTimerRef.current); otpTimerRef.current = null }
  }

  function parseOtpMetaFromItem(item: VaultItem | null): { secret: string; digits: number; algorithm: string; step: number } | null {
    if (!item) return null
    try {
      if (typeof item.notes === 'string' && item.notes.startsWith('otp:')) {
        const parts = item.notes.replace(/^otp:/, '').split(';')
        const map = Object.fromEntries(parts.map(kv => kv.split('='))) as any
        const otpUrl = map.otpurl ? decodeURIComponent(map.otpurl) : ''
        if (otpUrl && otpUrl.toLowerCase().startsWith('otpauth://')) {
          const match = otpUrl.match(/[?&]secret=([^&]+)/i)
          const secret = match ? decodeURIComponent(match[1]) : ''
          const digitsMatch = otpUrl.match(/[?&]digits=(\d+)/i)
          const algoMatch = otpUrl.match(/[?&]algorithm=([^&]+)/i)
          const periodMatch = otpUrl.match(/[?&](period|step)=(\d+)/i)
          const digits = digitsMatch ? Math.max(6, parseInt(digitsMatch[1], 10) || 6) : 6
          const algorithm = (algoMatch ? (algoMatch[1] || 'SHA1') : 'SHA1').toUpperCase()
          const step = periodMatch ? (parseInt(periodMatch[2] || periodMatch[1], 10) || 30) : 30
          return { secret, digits, algorithm, step }
        } else {
          const secret = decodeURIComponent(map.secret || '')
          const digits = Math.max(6, parseInt(map.digits || '6', 10) || 6)
          const algorithm = String(map.algorithm || 'SHA1').toUpperCase()
          const step = Math.max(5, parseInt(map.step || '30', 10) || 30)
          return { secret, digits, algorithm, step }
        }
      }
      if (typeof item.password === 'string' && item.password.toLowerCase().startsWith('otpauth://')) {
        const otpUrl = item.password
        const match = otpUrl.match(/[?&]secret=([^&]+)/i)
        const secret = match ? decodeURIComponent(match[1]) : ''
        const digitsMatch = otpUrl.match(/[?&]digits=(\d+)/i)
        const algoMatch = otpUrl.match(/[?&]algorithm=([^&]+)/i)
        const periodMatch = otpUrl.match(/[?&](period|step)=(\d+)/i)
        const digits = digitsMatch ? Math.max(6, parseInt(digitsMatch[1], 10) || 6) : 6
        const algorithm = (algoMatch ? (algoMatch[1] || 'SHA1') : 'SHA1').toUpperCase()
        const step = periodMatch ? (parseInt(periodMatch[2] || periodMatch[1], 10) || 30) : 30
        return { secret, digits, algorithm, step }
      }
    } catch {}
    return null
  }

  const selectedOtpMeta = useMemo(() => parseOtpMetaFromItem(selectedItem), [selectedItem])

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
  }, [selectedOtpMeta?.secret, selectedOtpMeta?.digits, selectedOtpMeta?.algorithm, selectedOtpMeta?.step, selectedOtpMeta, generateTotp])

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
      notes: password.notes || ''
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
      {/* Items list */}
      <div className="bg-card border-r border-border flex flex-col min-h-0" style={{ width: listWidth }}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">{t('nav.passwords')}</h1>
            <button 
              className="h-9 w-9 bg-primary hover:bg-primary-hover rounded-lg flex items-center justify-center transition-colors"
              title={t('actions.add')}
              onClick={() => setShowCreateForm(true)}
            >
              <Icon name="plus" size={16} className="text-primary-foreground" />
            </button>
          </div>
          
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={t('search.placeholder') as string} 
              value={search} 
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              className="pl-10 bg-muted/50 border-0 focus:bg-background"
            />
          </div>
        </div>

        {/* Items list */}
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
                onClick={() => dispatch(setSelectedItemId(p.id))} 
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
                      {/* OTP badge indicator if notes contain otp metadata */}
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

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => setIsResizing(true)}
        className={`w-1 cursor-col-resize bg-transparent hover:bg-border active:bg-border`} 
      />

      {/* Details panel */}
      <div className="flex-1 bg-background">
        {showCreateForm ? (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingPassword ? t('actions.editPassword') : t('actions.addPassword')}
                </h2>
                <Button variant="ghost" onClick={resetForm}>
                  <Icon name="x" size={16} />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-foreground">{t('fields.title')}</label>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={scanCopied}
                        onClick={async () => {
                          try {
                            const dataUrl: string | null = await (window as any).cloudpass.cropScreen()
                            if (!dataUrl) return
                            await decodeFromDataUrl(dataUrl)
                          } catch {}
                        }}
                        title={scanCopied ? (t('actions.copied') as string) : (t('actions.scanQr') as string)}
                      >
                        {scanCopied ? t('actions.copied') : t('actions.scanQr')}
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
                    <div className="flex gap-2 items-center">
                      <Input
                        value={otpActive ? currentOtpCode : formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder={t('fields.password') as string}
                        type={showPassword ? 'text' : 'password'}
                        className="flex-1"
                      />
                      {otpActive && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {t('otp.refreshIn', { seconds: otpSecondsLeft })}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowPassword(v => !v)}
                        title={showPassword ? 'Hide' : 'View'}
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
                          const password = Array.from({length: 16}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
                          setFormData(prev => ({ ...prev, password }))
                        }}
                        title={t('actions.generatePassword')}
                      >
                        <Icon name="rotate-ccw" size={16} />        
                      </Button>
                      {/* Scan QR moved near Title */}
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
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.notes')}</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder={t('fields.notes') as string}
                      className="w-full min-h-[100px] px-3 py-2 bg-background border border-input rounded-lg text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent transition-all duration-200 resize-vertical"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-6">
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
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>
                    {t('actions.cancel')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : selectedId ? (
          (() => {
            const p = passwords.find(x => x.id === selectedId)
            if (!p) return (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-muted-foreground">{t('vault.empty')}</div>
                </div>
              </div>
            )
            const otpMeta = selectedOtpMeta

            return (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
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
                    
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(p)}>
                        {t('actions.edit')}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleDeleteClick(p)}
                      >
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </div>
                  
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      {p.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content (read-only form layout) */}
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.title')}</label>
                      <div className="h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{p.title}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.username')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm">{p.username || ''}</div>
                        <button 
                          className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                          onClick={() => copyWithFeedback(p.username ?? '', t('clipboard.usernameCopied'), showToast)}
                          title={t('actions.copy')}
                        >
                          {t('actions.copy')}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.password')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center font-mono text-sm">
                          {selectedOtpMeta ? (
                            <span className="flex items-center gap-2">
                              <span>{showPassword ? detailOtpCode : '••••••'}</span>
                              <span className="text-xs text-muted-foreground">{t('otp.refreshIn', { seconds: detailOtpSecondsLeft })}</span>
                            </span>
                          ) : (p.password && p.password.toLowerCase().startsWith('otpauth://') ? '••••••••' : showPassword ? p.password : '•'.repeat(12))}
                        </div>
                        <button 
                          className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                                              >
                        {showPassword ? (
                          <Icon name="eye-off" size={16} />
                        ) : (
                          <Icon name="eye" size={16} />
                        )}
                      </button>
                        <button 
                          className="h-10 px-3 bg-primary hover:bg-primary-hover rounded-lg text-sm text-primary-foreground"
                          onClick={async () => {
                            // If this is an OTP item, copy the current live code
                            if (typeof p.notes === 'string' && p.notes.startsWith('otp:')) {
                              const code = detailOtpCode || ''
                              await copyWithFeedback(code, t('clipboard.passwordCopied'), showToast)
                              return
                            }
                            if (!p.ssmArn) {
                              // If password stores otpauth URL, copy live token instead
                              if (p.password && p.password.toLowerCase().startsWith('otpauth://')) {
                                await copyWithFeedback(detailOtpCode || '', t('clipboard.passwordCopied'), showToast)
                                return
                              }
                              await copyWithFeedback(p.password ?? '', t('clipboard.passwordCopied'), showToast)
                              return
                            }
                            try {
                              const { resolveVaultContext } = await import('../services/vaultPaths')
                              const { region, profile } = resolveVaultContext({ uid, selectedVaultId, email, regionOverride: awsRegion })
                              const secret = await window.cloudpass.teamGetSecretValue(awsRegion || region, p.ssmArn, awsProfile || profile)
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
                          }}
                          title={t('actions.copy')}
                        >
                        <Icon name="copy" size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('fields.url')}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 px-3 bg-muted/50 rounded-lg flex items-center text-sm truncate">{p.url || ''}</div>
                        {!!p.url && (
                          <button 
                            className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                            onClick={() => window.open(p.url!, '_blank')}
                            title={t('actions.open') as string}
                          >
                            {t('actions.open')}
                          </button>
                        )}
                      </div>
                    </div>
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
        onClose={() => setDeleteConfirm({isOpen: false, item: null})}
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

export default function Passwords(): React.JSX.Element {
  return (
    <MasterGate>
      <Content />
    </MasterGate>
  )
}


