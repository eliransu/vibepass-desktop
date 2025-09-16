import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { encryptJson, decryptJson } from '../../shared/security/crypto'
import { resolveVaultContext, getVaultSecretNameWithOverrides } from './vaultPaths'
import { v4 as uuidv4 } from 'uuid'

export type VaultItem = {
  id: string
  title: string
  username?: string
  password?: string
  url?: string
  notes?: string
  tags?: string[]
  category?: 'passwords' | 'notes' | 'cards' | 'team' | 'api-keys'
  favorite?: boolean
  // New: arn of secret in AWS that stores the encrypted item JSON
  ssmArn?: string
}

export const vaultApi = createApi({
  reducerPath: 'vaultApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Vault'],
  endpoints: (build) => ({
    // List: read metadata from Firestore and merge with consolidated SSM vault blob
    list: build.query<VaultItem[], { uid: string; key: string; selectedVaultId: string; regionOverride?: string; profileOverride?: string; accountIdOverride?: string }>({
      async queryFn({ uid, key, selectedVaultId, regionOverride, profileOverride, accountIdOverride }) {
        try {
          const storageMode = (typeof localStorage !== 'undefined' && (localStorage.getItem('storageMode') as 'cloud' | 'local' | null)) || undefined
          if (storageMode === 'local') {
            const preload = (window as any).cloudpass as any
            const localKey = `localVault:${selectedVaultId}`
            const enc = preload ? await preload.storeGet(localKey) : undefined
            let consolidated: Record<string, VaultItem> = {}
            if (enc && typeof enc === 'string' && enc.length > 0) {
              try {
                consolidated = decryptJson<Record<string, VaultItem>>(enc, key)
              } catch {
                try { consolidated = JSON.parse(enc) as Record<string, VaultItem> } catch { consolidated = {} }
              }
            }
            return { data: Object.values(consolidated) }
          }
          if (!accountIdOverride || !regionOverride) {
            return { data: [] }
          }
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })
          // Pull consolidated vault secret
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          
          // Debug logging removed
          
          const preload = (window as any).cloudpass as any
          let consolidated: Record<string, VaultItem> = {}
          if (preload) {
            const vaultResult = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            
            // Handle null result (defensive programming)
            if (!vaultResult) {
              console.error('❌ vaultRead returned null - this should not happen with new API')
              return { data: [] }
            }
            
            // Handle AccessDeniedException
            if (!vaultResult.success) {
              if (vaultResult.error === 'AccessDeniedException') {
                const event = new CustomEvent('vault-access-denied', { 
                  detail: { message: vaultResult.message, secretName: name } 
                })
                window.dispatchEvent(event)
              }
              return { error: { status: 403, data: vaultResult.message } }
            }
            
            let secret = vaultResult.data
            
            // No department-based fallbacks; paths are fixed
            
            if (secret) {
              try {
                consolidated = isWork
                  ? (JSON.parse(secret) as Record<string, VaultItem>)
                  : decryptJson<Record<string, VaultItem>>(secret, key)
                // Removed verbose success logs
              } catch (decryptError: any) {
                console.error('❌ Decryption failed:', decryptError.message)
                
                // Try to determine if the data is actually encrypted
                try {
                  const parsed = JSON.parse(secret)
                  consolidated = parsed as Record<string, VaultItem>
                } catch {
                  console.error('❌ Secret is neither valid encrypted data nor valid JSON')
                  throw new Error(`Failed to decrypt vault data: ${decryptError.message}`)
                }
              }
            } else if (isWork) {
              // Removed verbose not-found hints
            }
          }
          return { data: Object.values(consolidated) }
        } catch (e: any) {
          console.error('🚨 Vault API error:', e.message)
          return { error: { error: e.message } as any }
        }
      },
      providesTags: (result) =>
        result ? [...result.map((i) => ({ type: 'Vault' as const, id: i.id })), { type: 'Vault', id: 'LIST' }] : [{ type: 'Vault', id: 'LIST' }],
    }),
    // Create: upsert into consolidated SSM blob (per-vault) and store metadata in Firestore
    create: build.mutation<void, { uid: string; key: string; item: VaultItem; selectedVaultId: string; regionOverride?: string; profileOverride?: string; accountIdOverride?: string }>({
      async queryFn({ uid, key, item, selectedVaultId, regionOverride, profileOverride, accountIdOverride }) {
        try {
          const storageMode = (typeof localStorage !== 'undefined' && (localStorage.getItem('storageMode') as 'cloud' | 'local' | null)) || undefined
          if (storageMode === 'local') {
            const preload = (window as any).cloudpass as any
            const localKey = `localVault:${selectedVaultId}`
            const currentEnc = preload ? await preload.storeGet(localKey) : undefined
            let parsed: Record<string, VaultItem> = {}
            if (currentEnc) {
              try { parsed = decryptJson<Record<string, VaultItem>>(currentEnc, key) } catch { try { parsed = JSON.parse(currentEnc) } catch { parsed = {} } }
            }
            const newId = item.id && item.id.trim().length > 0 ? item.id : uuidv4()
            parsed[newId] = { ...item, id: newId }
            const enc = encryptJson(parsed, key)
            if (preload) await preload.storeSet(localKey, enc)
            return { data: undefined }
          }
          if (!accountIdOverride || !regionOverride) {
            throw new Error('Missing AWS context')
          }
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })

          // Update consolidated blob
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          const preload = (window as any).cloudpass as any
          if (preload) {
            const currentResult = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            if (!currentResult) {
              console.error('❌ vaultRead returned null - this should not happen with new API')
              return { error: { status: 500, data: 'Vault read failed' } }
            }
            if (!currentResult.success) {
              if (currentResult.error === 'AccessDeniedException') {
                const event = new CustomEvent('vault-access-denied', { 
                  detail: { message: currentResult.message, secretName: name } 
                })
                window.dispatchEvent(event)
              }
              return { error: { status: 403, data: currentResult.message } }
            }
            const current = currentResult.data
            let parsed: Record<string, VaultItem> = {}
            if (current) {
              try {
                parsed = isWork 
                  ? (JSON.parse(current) as Record<string, VaultItem>)
                  : decryptJson<Record<string, VaultItem>>(current, key)
              } catch (decryptError: any) {
                console.error('❌ Decryption failed in create operation:', decryptError.message)
                // Try parsing as plain JSON
                try {
                  parsed = JSON.parse(current) as Record<string, VaultItem>
                } catch {
                  parsed = {}
                }
              }
            }
            const newId = item.id && item.id.trim().length > 0 ? item.id : uuidv4()
            parsed[newId] = { ...item, id: newId }
            const enc = isWork ? JSON.stringify(parsed) : encryptJson(parsed, key)
            await preload.vaultWrite(regionOverride || region, name, enc, profileOverride || profile)
          }
          return { data: undefined }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      invalidatesTags: [{ type: 'Vault', id: 'LIST' }],
    }),
    // Update: modify consolidated blob; update metadata doc
    update: build.mutation<void, { uid: string; key: string; item: VaultItem; selectedVaultId: string; regionOverride?: string; profileOverride?: string; accountIdOverride?: string }>({
      async queryFn({ uid, key, item, selectedVaultId, regionOverride, profileOverride, accountIdOverride }) {
        try {
          const storageMode = (typeof localStorage !== 'undefined' && (localStorage.getItem('storageMode') as 'cloud' | 'local' | null)) || undefined
          if (storageMode === 'local') {
            const preload = (window as any).cloudpass as any
            const localKey = `localVault:${selectedVaultId}`
            const currentEnc = preload ? await preload.storeGet(localKey) : undefined
            let parsed: Record<string, VaultItem> = {}
            if (currentEnc) {
              try { parsed = decryptJson<Record<string, VaultItem>>(currentEnc, key) } catch { try { parsed = JSON.parse(currentEnc) } catch { parsed = {} } }
            }
            parsed[item.id] = { ...parsed[item.id], ...item }
            const enc = encryptJson(parsed, key)
            if (preload) await preload.storeSet(localKey, enc)
            return { data: undefined }
          }
          if (!accountIdOverride || !regionOverride) {
            throw new Error('Missing AWS context')
          }
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })

          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          const preload = (window as any).cloudpass as any
          if (preload) {
            const currentResult = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            if (!currentResult) {
              console.error('❌ vaultRead returned null - this should not happen with new API')
              return { error: { status: 500, data: 'Vault read failed' } }
            }
            if (!currentResult.success) {
              if (currentResult.error === 'AccessDeniedException') {
                const event = new CustomEvent('vault-access-denied', { 
                  detail: { message: currentResult.message, secretName: name } 
                })
                window.dispatchEvent(event)
              }
              return { error: { status: 403, data: currentResult.message } }
            }
            const current = currentResult.data
            let parsed: Record<string, VaultItem> = {}
            if (current) {
              try {
                parsed = isWork 
                  ? (JSON.parse(current) as Record<string, VaultItem>)
                  : decryptJson<Record<string, VaultItem>>(current, key)
              } catch (decryptError: any) {
                console.error('❌ Decryption failed in update operation:', decryptError.message)
                // Try parsing as plain JSON
                try {
                  parsed = JSON.parse(current) as Record<string, VaultItem>
                } catch {
                  parsed = {}
                }
              }
            }
            parsed[item.id] = { ...parsed[item.id], ...item }
            const enc = isWork ? JSON.stringify(parsed) : encryptJson(parsed, key)
            await preload.vaultWrite(regionOverride || region, name, enc, profileOverride || profile)
          }
          return { data: undefined }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      // Invalidate both the specific item and the LIST to ensure list query refreshes
      invalidatesTags: (_result, _error, arg) => [{ type: 'Vault', id: arg.item.id }, { type: 'Vault', id: 'LIST' }],
    }),
    // Remove: delete from consolidated blob; remove doc
    remove: build.mutation<void, { uid: string; key: string; id: string; selectedVaultId: string; regionOverride?: string; profileOverride?: string; accountIdOverride?: string }>({
      async queryFn({ uid, key, id, selectedVaultId, regionOverride, profileOverride, accountIdOverride }) {
        try {
          const storageMode = (typeof localStorage !== 'undefined' && (localStorage.getItem('storageMode') as 'cloud' | 'local' | null)) || undefined
          if (storageMode === 'local') {
            const preload = (window as any).cloudpass as any
            const localKey = `localVault:${selectedVaultId}`
            const currentEnc = preload ? await preload.storeGet(localKey) : undefined
            let parsed: Record<string, VaultItem> = {}
            if (currentEnc) {
              try { parsed = decryptJson<Record<string, VaultItem>>(currentEnc, key) } catch { try { parsed = JSON.parse(currentEnc) } catch { parsed = {} } }
            }
            delete parsed[id]
            const enc = encryptJson(parsed, key)
            if (preload) await preload.storeSet(localKey, enc)
            return { data: undefined }
          }
          if (!accountIdOverride || !regionOverride) {
            throw new Error('Missing AWS context')
          }
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const preload = (window as any).cloudpass as any
          if (preload) {
            const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
            const isWork = selectedVaultId === 'work'
            const currentResult = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            if (!currentResult) {
              console.error('❌ vaultRead returned null - this should not happen with new API')
              return { error: { status: 500, data: 'Vault read failed' } }
            }
            if (!currentResult.success) {
              if (currentResult.error === 'AccessDeniedException') {
                const event = new CustomEvent('vault-access-denied', { 
                  detail: { message: currentResult.message, secretName: name } 
                })
                window.dispatchEvent(event)
              }
              return { error: { status: 403, data: currentResult.message } }
            }
            const current = currentResult.data
            let parsed: Record<string, VaultItem> = {}
            if (current) {
              try {
                parsed = isWork 
                  ? (JSON.parse(current) as Record<string, VaultItem>)
                  : decryptJson<Record<string, VaultItem>>(current, key)
              } catch (decryptError: any) {
                console.error('❌ Decryption failed in remove operation:', decryptError.message)
                // Try parsing as plain JSON
                try {
                  parsed = JSON.parse(current) as Record<string, VaultItem>
                } catch {
                  parsed = {}
                }
              }
            }
            delete parsed[id]
            const enc = isWork ? JSON.stringify(parsed) : encryptJson(parsed, key)
            await preload.vaultWrite(regionOverride || region, name, enc, profileOverride || profile)
          }
          return { data: undefined }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      invalidatesTags: [{ type: 'Vault', id: 'LIST' }],
    }),
  }),
})

export const { useListQuery, useCreateMutation, useUpdateMutation, useRemoveMutation } = vaultApi


