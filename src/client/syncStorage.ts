/**
 * Zustand persist storage replacing MuseAI's Tauri diskStorage: the envelope
 * (zustand `{ state, version }` JSON) is stored server-side through the
 * plugin's store routes, with the browser localStorage as an offline/legacy
 * mirror. The signature mirrors MuseAI's `createDiskStorage(name,
 * localStorageKey)` so ported stores only change the import.
 * @module @yejiming/dsh-museai-tavern/client/syncStorage
 */

import { StateStorage } from 'zustand/middleware'
import { getStore, putStore, type StoreBlobWire } from './api.ts'

/** Is this a non-empty persisted envelope worth restoring from the server? */
function isMeaningful(blob: StoreBlobWire | undefined): blob is StoreBlobWire {
  if (blob === undefined) return false
  if (blob.version !== undefined && blob.version > 0) return true
  return blob.state !== undefined && Object.keys(blob.state).length > 0
}

/**
 * Create the sync storage for one store.
 * @param name - server-side store key (whitelisted on the routes half).
 * @param localStorageKey - legacy localStorage key (migrated into the server
 * on first read, mirrored on write for offline fallback).
 */
export function createSyncStorage(name: string, localStorageKey?: string): StateStorage {
  return {
    getItem: async () => {
      try {
        const blob = await getStore(name)
        if (isMeaningful(blob)) {
          // Server holds data: mirror it locally (cheap) and return it.
          if (localStorageKey !== undefined) {
            try {
              localStorage.setItem(localStorageKey, JSON.stringify(blob))
            } catch {
              // Mirror is best-effort.
            }
          }
          return JSON.stringify(blob)
        }
        // An empty envelope (`{state:{}, version:0}`) is an absent store —
        // returning it would trip zustand's persist migration warning.
        return null
      } catch {
        // Server unreachable — fall through to the local mirror.
      }
      if (localStorageKey !== undefined) {
        const oldData = localStorage.getItem(localStorageKey)
        if (oldData !== null) {
          // Legacy data: migrate it into the server best-effort.
          try {
            const parsed = JSON.parse(oldData) as StoreBlobWire
            void putStore(name, parsed).catch(() => {})
          } catch {
            // Keep the local copy; server hydration is best-effort.
          }
          return oldData
        }
      }
      return null
    },
    setItem: async (_name, value) => {
      if (localStorageKey !== undefined) {
        try {
          localStorage.setItem(localStorageKey, value)
        } catch {
          // Quota/availability — the server write below is the authority.
        }
      }
      try {
        await putStore(name, JSON.parse(value) as StoreBlobWire)
      } catch {
        // Server unreachable: the local mirror keeps the session usable.
      }
    },
    removeItem: async () => {
      // No-op: clearing app data is not exposed (mirrors diskStorage).
    },
  }
}
