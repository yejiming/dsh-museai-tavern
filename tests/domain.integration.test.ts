/**
 * Integration test: the museai store service over the real storage-domain
 * stack (storage hub + json backend + domain form), in a temp directory.
 * Verifies:
 * - domain-backed durability (a put lands in the backend file),
 * - memory fallback when the facility is absent,
 * - the upgrade path when the facility mounts after the store was created.
 * @module @yejiming/dsh-museai-tavern/tests/domain.integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { Storage } from '@deepseek-ai/dsh-storage'
import * as StorageJsonPlugin from '@deepseek-ai/dsh-storage-json'
import * as StorageDomainPlugin from '@deepseek-ai/dsh-storage-domain'
import { createMuseaiStore, STORE_KEYS, type MuseaiStore } from '../src/domain.ts'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'museai-domain-test-'))
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

/** Mount the storage stack (hub + json backend + domain form) on a context. */
function mountStorage(ctx: Context): Array<{ dispose: () => Promise<void> }> {
  return [
    ctx.plugin(Storage),
    ctx.plugin(StorageJsonPlugin, { root }),
    ctx.plugin(StorageDomainPlugin, { backend: 'json' }),
  ]
}

/** Wait until the store facade reports durable (or the deadline passes). */
async function waitDurable(store: MuseaiStore, deadlineMs = 3000): Promise<boolean> {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (store.durable) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return store.durable
}

describe('museai store over the storage domain', () => {
  it('persists store envelopes and sessions durably when the facility is present', async () => {
    const c = new Context()
    const fibers = mountStorage(c)
    await new Promise((resolve) => setTimeout(resolve, 30))

    const store = await createMuseaiStore(c)
    expect(await waitDurable(store)).toBe(true)

    await store.putStore('settings', { state: { temperature: 0.7 }, version: 1 })
    expect(store.getStore('settings')).toEqual({ state: { temperature: 0.7 }, version: 1 })

    await store.putSession('partner', {
      id: 's1',
      title: '测试会话',
      savedAt: 123,
      messages: [{ id: 'm1', role: 'user', content: '你好' }],
      characterCardId: 'card-1',
    })
    expect(store.getSession('partner', 's1')?.title).toBe('测试会话')
    expect(store.listSessions('partner').map((s) => s.id)).toEqual(['s1'])
    expect(store.listSessions('story')).toEqual([])

    // The json backend must have materialized the domain file.
    const unitPath = join(root, 'museai.json')
    expect(existsSync(unitPath)).toBe(true)
    const persisted = JSON.parse(readFileSync(unitPath, 'utf8')) as {
      tables: { store?: Record<string, unknown>; sessions?: Record<string, unknown> }
    }
    expect(persisted.tables.store).toHaveProperty('settings')
    expect(persisted.tables.sessions).toHaveProperty('partner:s1')

    // Re-open: a fresh store over the same root sees the records.
    const c2 = new Context()
    const mountStorageC2 = mountStorage(c2)
    await new Promise((resolve) => setTimeout(resolve, 30))
    const store2 = await createMuseaiStore(c2)
    expect(await waitDurable(store2)).toBe(true)
    expect(store2.getStore('settings')).toEqual({ state: { temperature: 0.7 }, version: 1 })
    expect(store2.getSession('partner', 's1')?.characterCardId).toBe('card-1')

    await store2.deleteSession('partner', 's1')
    expect(store2.getSession('partner', 's1')).toBeUndefined()
    for (const fiber of [...mountStorageC2, ...fibers]) await fiber.dispose()
  })

  it('falls back to memory when the facility is absent, then upgrades when it mounts', async () => {
    const c = new Context()
    let mountStorageLater: Array<{ dispose: () => Promise<void> }> = []
    // No storage plugins mounted yet: the store must be memory-backed.
    const store = await createMuseaiStore(c)
    expect(store.durable).toBe(false)
    await store.putStore('partners', { state: { items: [{ id: 'wb1' }] }, version: 1 })
    expect(store.getStore('partners')?.state).toEqual({ items: [{ id: 'wb1' }] })

    // Mount the storage stack afterwards; the store must upgrade to durable
    // and the earlier memory write must be flushed into the domain.
    mountStorageLater = mountStorage(c)
    expect(await waitDurable(store)).toBe(true)
    expect(store.getStore('partners')?.state).toEqual({ items: [{ id: 'wb1' }] })
    const unitPath = join(root, 'museai.json')
    expect(existsSync(unitPath)).toBe(true)
    const persisted = JSON.parse(readFileSync(unitPath, 'utf8')) as {
      tables: { store?: Record<string, unknown> }
    }
    expect(persisted.tables.store).toHaveProperty('partners')
    for (const fiber of mountStorageLater) await fiber.dispose()
  })

  it('exposes the whitelisted store keys', () => {
    expect(STORE_KEYS).toEqual(['settings', 'partners', 'partnerChat', 'story', 'stylePresets', 'agent'])
  })
})
