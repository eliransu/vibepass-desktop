import CryptoJS from 'crypto-js'

export function deriveKeyFromMasterPassword(masterPassword: string, salt: string): string {
  const key = CryptoJS.PBKDF2(masterPassword, salt, { keySize: 256 / 32, iterations: 100_000 })
  return key.toString()
}

export function encryptJson(data: unknown, key: string): string {
  const plaintext = JSON.stringify(data)
  return CryptoJS.AES.encrypt(plaintext, key).toString()
}

export function decryptJson<T>(ciphertext: string, key: string): T {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  const plaintext = bytes.toString(CryptoJS.enc.Utf8)
  return JSON.parse(plaintext) as T
}


