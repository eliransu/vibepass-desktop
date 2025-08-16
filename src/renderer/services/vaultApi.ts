import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, firebaseEnabled } from '../../shared/firebase'
import { encryptJson, decryptJson } from '../../shared/security/crypto'
// Ambient typing is provided via types/preload.d.ts; use `any` cast for window.vibepass
import { resolveVaultContext, getVaultSecretNameWithOverrides } from './vaultPaths'

export type VaultItem = {
  id: string
  title: string
  username?: string
  password?: string
  url?: string
  notes?: string
  tags?: string[]
  category?: 'passwords' | 'notes' | 'cards' | 'team'
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
        if (!firebaseEnabled || !db) {
          return { data: [] }
        }
        try {
          const { collectionPath, region, profile } = resolveVaultContext({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const col = collection(db, collectionPath)
          const snap = await getDocs(col)
          const metaById: Record<string, VaultItem> = {}
          snap.forEach((d) => {
            const data = d.data() as any
            metaById[d.id] = {
              id: d.id,
              title: data.title ?? '',
              tags: data.tags ?? [],
              category: data.category ?? 'passwords',
              favorite: data.favorite ?? false,
            }
          })

          // Pull consolidated vault secret and merge
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId, regionOverride, accountIdOverride })
          const preload = (window as any).vibepass as any
          let consolidated: Record<string, VaultItem> = {}
          if (preload) {
            const secret = await preload.vaultRead(regionOverride || region, name, profileOverride || profile)
            if (secret) {
              consolidated = decryptJson<Record<string, VaultItem>>(secret, key)
            }
          }
          const merged: VaultItem[] = Object.values(metaById).map((m) => ({ ...m, ...(consolidated[m.id] || {}) }))
          return { data: merged }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      providesTags: (result) =>
        result ? [...result.map((i) => ({ type: 'Vault' as const, id: i.id })), { type: 'Vault', id: 'LIST' }] : [{ type: 'Vault', id: 'LIST' }],
    }),
    // Create: upsert into consolidated SSM blob (per-vault) and store metadata in Firestore
    create: build.mutation<void, { uid: string; key: string; item: VaultItem; selectedVaultId: string }>({
      async queryFn({ uid, key, item, selectedVaultId }) {
        if (!firebaseEnabled || !db) {
          return { error: { error: 'Firebase disabled' } as any }
        }
        try {
          const { collectionPath, region, profile } = resolveVaultContext({ uid, selectedVaultId })
          const ref = doc(collection(db, collectionPath))
          await setDoc(ref, { title: item.title, tags: item.tags ?? [], category: item.category ?? 'passwords', favorite: item.favorite ?? false })

          // Update consolidated blob
          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId })
          const preload = (window as any).vibepass as any
          if (preload) {
            const current = await preload.vaultRead(region, name, profile)
            const parsed: Record<string, VaultItem> = current ? decryptJson<Record<string, VaultItem>>(current, key) : {}
            parsed[ref.id] = { ...item, id: ref.id }
            const enc = encryptJson(parsed, key)
            await preload.vaultWrite(region, name, enc, profile)
          }
          return { data: undefined }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      invalidatesTags: [{ type: 'Vault', id: 'LIST' }],
    }),
    // Update: modify consolidated blob; update metadata doc
    update: build.mutation<void, { uid: string; key: string; item: VaultItem; selectedVaultId: string }>({
      async queryFn({ uid, key, item, selectedVaultId }) {
        if (!firebaseEnabled || !db) {
          return { error: { error: 'Firebase disabled' } as any }
        }
        try {
          const { collectionPath, region, profile } = resolveVaultContext({ uid, selectedVaultId })
          const ref = doc(db, collectionPath, item.id)
          await updateDoc(ref, { title: item.title, tags: item.tags ?? [], category: item.category ?? 'passwords', favorite: item.favorite ?? false })

          const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId })
          const preload = (window as any).vibepass as any
          if (preload) {
            const current = await preload.vaultRead(region, name, profile)
            const parsed: Record<string, VaultItem> = current ? decryptJson<Record<string, VaultItem>>(current, key) : {}
            parsed[item.id] = { ...parsed[item.id], ...item }
            const enc = encryptJson(parsed, key)
            await preload.vaultWrite(region, name, enc, profile)
          }
          return { data: undefined }
        } catch (e: any) {
          return { error: { error: e.message } as any }
        }
      },
      invalidatesTags: (_result, _error, arg) => [{ type: 'Vault', id: arg.item.id }],
    }),
    // Remove: delete from consolidated blob; remove doc
    remove: build.mutation<void, { uid: string; key: string; id: string; selectedVaultId: string }>({
      async queryFn({ uid, key, id, selectedVaultId }) {
        if (!firebaseEnabled || !db) {
          return { error: { error: 'Firebase disabled' } as any }
        }
        try {
          const { collectionPath, region, profile } = resolveVaultContext({ uid, selectedVaultId })
          const ref = doc(db, collectionPath, id)
          const preload = (window as any).vibepass as any
          if (preload) {
            const name = getVaultSecretNameWithOverrides({ uid, selectedVaultId })
            const current = await preload.vaultRead(region, name, profile)
            const parsed: Record<string, VaultItem> = current ? decryptJson<Record<string, VaultItem>>(current, key) : {}
            delete parsed[id]
            const enc = encryptJson(parsed, key)
            await preload.vaultWrite(region, name, enc, profile)
          }
          await deleteDoc(ref)
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


