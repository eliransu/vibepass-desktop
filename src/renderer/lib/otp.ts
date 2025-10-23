import { HashAlgorithms, KeyEncodings } from '@otplib/core'
import { createDigest } from '@otplib/plugin-crypto-js'
import type { VaultItem } from '../services/vaultApi'

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

function createTotpHmacKey(algorithm: HashAlgorithms, secretBase32: string, _encoding: KeyEncodings): string {
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
}

export function generateTotp(secretBase32: string, opts: { digits: number; algorithm: string; step: number; epoch: number }): string {
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
}

export function parseOtpMetaFromItem(item: VaultItem | null): { secret: string; digits: number; algorithm: string; step: number } | null {
  if (!item) return null
  try {
    if (typeof item.notes === 'string' && item.notes.startsWith('otp:')) {
      const parts = item.notes.replace(/^otp:/, '').split(';')
      const map = Object.fromEntries(parts.map(kv => kv.split('='))) as Record<string, string>
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


