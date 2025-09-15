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
            
            // Try alternative method: direct secret access by ARN (if configured)
            if (!secret && isWork) {
              // Build ARN from configuration instead of hardcoding
              const currentAccountId = accountIdOverride
              const currentRegion = regionOverride || region
              const tenant = (typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || 'default'
              const department = (typeof localStorage !== 'undefined' && localStorage.getItem('department')) || 'engineering'
              
              if (currentAccountId && currentRegion) {
                const arn = `arn:aws:secretsmanager:${currentRegion}:${currentAccountId}:secret:cloudpass/${tenant}/${currentAccountId}/${currentRegion}/${department}/vault-*`
                try {
                  secret = await preload.teamGetSecretValue(currentRegion, arn, profileOverride || profile)
                  // Removed verbose logs
                } catch (e: any) {
                  // Ignore direct ARN access failures
                }
              } else {
                // Missing account/region; skip
              }
            }
            
            // If still not found and this is a work vault, try alternative naming patterns
            if (!secret && isWork) {
              const alternativeNames = [
                // Try without department name (old format)
                `cloudpass/${(typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || 'default'}/${accountIdOverride}/${regionOverride}/department/vault`,
                // Try with different department names
                `cloudpass/${(typeof localStorage !== 'undefined' && localStorage.getItem('tenant')) || 'default'}/${accountIdOverride}/${regionOverride}/engineering/vault`,
                // Try the pattern from your JSON (if it was stored differently)
                name.replace('/team/', '/department/'),
                name.replace('/team/', '/engineering/'),
                name.replace('/applications/', '/department/')
              ]
              
              for (const altName of alternativeNames) {
                if (altName !== name) {
                  try {
                    const altResult = await preload.vaultRead(regionOverride || region, altName, profileOverride || profile)
                    if (!altResult) continue
                    if (!altResult.success) {
                      if (altResult.error === 'AccessDeniedException') {
                        const event = new CustomEvent('vault-access-denied', { 
                          detail: { message: altResult.message, secretName: altName } 
                        })
                        window.dispatchEvent(event)
                      }
                      continue
                    }
                    secret = altResult.data
                    if (secret) { break }
                  } catch {
                    // Continue trying
                  }
                }
              }
            }
            
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
      invalidatesTags: (_result, _error, arg) => [{ type: 'Vault', id: arg.item.id }],
    }),
    // Remove: delete from consolidated blob; remove doc
    remove: build.mutation<void, { uid: string; key: string; id: string; selectedVaultId: string; regionOverride?: string; profileOverride?: string; accountIdOverride?: string }>({
      async queryFn({ uid, key, id, selectedVaultId, regionOverride, profileOverride, accountIdOverride }) {
        try {
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


