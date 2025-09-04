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
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })
          // Pull consolidated vault secret
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          const preload = (window as any).cloudpass as any
          let consolidated: Record<string, VaultItem> = {}
          if (preload) {
            const secret = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            if (secret) {
              consolidated = isWork
                ? (JSON.parse(secret) as Record<string, VaultItem>)
                : decryptJson<Record<string, VaultItem>>(secret, key)
            }
          }
          return { data: Object.values(consolidated) }
        } catch (e: any) {
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
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })

          // Update consolidated blob
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          const preload = (window as any).cloudpass as any
          if (preload) {
            const current = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            const parsed: Record<string, VaultItem> = current
              ? (isWork ? (JSON.parse(current) as Record<string, VaultItem>) : decryptJson<Record<string, VaultItem>>(current, key))
              : {}
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
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })

          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const isWork = selectedVaultId === 'work'
          const preload = (window as any).cloudpass as any
          if (preload) {
            const current = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            const parsed: Record<string, VaultItem> = current
              ? (isWork ? (JSON.parse(current) as Record<string, VaultItem>) : decryptJson<Record<string, VaultItem>>(current, key))
              : {}
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
          const { region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const preload = (window as any).cloudpass as any
          if (preload) {
            const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
            const isWork = selectedVaultId === 'work'
            const current = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            const parsed: Record<string, VaultItem> = current
              ? (isWork ? (JSON.parse(current) as Record<string, VaultItem>) : decryptJson<Record<string, VaultItem>>(current, key))
              : {}
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


