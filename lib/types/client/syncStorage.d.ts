/**
 * Zustand persist storage replacing MuseAI's Tauri diskStorage: the envelope
 * (zustand `{ state, version }` JSON) is stored server-side through the
 * plugin's store routes, with the browser localStorage as an offline/legacy
 * mirror. The signature mirrors MuseAI's `createDiskStorage(name,
 * localStorageKey)` so ported stores only change the import.
 * @module @yejiming/dsh-museai-tavern/client/syncStorage
 */
import { StateStorage } from 'zustand/middleware';
/**
 * Create the sync storage for one store.
 * @param name - server-side store key (whitelisted on the routes half).
 * @param localStorageKey - legacy localStorage key (migrated into the server
 * on first read, mirrored on write for offline fallback).
 */
export declare function createSyncStorage(name: string, localStorageKey?: string): StateStorage;
