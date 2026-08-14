/**
 * MuseAI storage domain and the `museaiStore` service face.
 *
 * One domain (`museai`, version 1) with two tables:
 * - `store`    — the zustand persist envelopes of the MuseAI stores, keyed by
 *   the whitelisted store names (`settings`, `partners`, `partnerChat`,
 *   `story`, `stylePresets`). The envelope shape `{ state, version }` is what
 *   zustand persist writes, so the browser half can round-trip it verbatim.
 * - `sessions` — agent session records (`partner-session-*` / `story-session-*`
 *   from MuseAI), keyed `"<kind>:<id>"` with the characterCardId(s)/sessionKind
 *   metadata the bond page filters on.
 *
 * The `museaiStore` service is a facade that starts memory-backed and upgrades
 * to the storage domain the moment the storage-domain facility mounts (the
 * domain form activates late in the composition, after this row's apply). On
 * upgrade the memory contents are flushed into the domain, so nothing written
 * before the upgrade is lost. When no facility ever appears (lean assemblies)
 * the facade stays in-memory and logs a warning once.
 * @module @yejiming/dsh-museai-tavern/domain
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  defineDomain,
  domainTable,
  type Domain,
  type DomainFacility,
} from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

/** One persisted zustand store envelope. */
export interface StoreBlob {
  state: Record<string, unknown>
  version: number
}

/** Whitelisted store keys (mirrors MuseAI diskStorage config names). */
export const STORE_KEYS = ['settings', 'partners', 'partnerChat', 'story', 'stylePresets', 'agent'] as const
export type StoreKey = (typeof STORE_KEYS)[number]

/** Session kinds, mirroring MuseAI session prefixes. */
export const SESSION_KINDS = ['partner', 'story'] as const
export type SessionKind = (typeof SESSION_KINDS)[number]

/** One persisted conversation message (MuseAI `Message` wire shape). */
export interface SessionMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  thinking?: string
  thinkingBlocks?: { id: string; content: string; signature?: string }[]
  tools?: { id?: string; name: string; result: string; status?: string; arguments?: string }[]
  articleType?: string
  suggestedChoices?: string[]
}

/** One persisted agent session record (MuseAI `AgentSessionRecord` shape). */
export interface SessionRecord {
  id: string
  title: string
  savedAt: number
  sessionKind?: 'chat' | 'story' | 'bookTravel'
  characterCardId?: string | null
  characterCardIds?: string[] | null
  selectedWorldBookId?: string | null
  dynamicRoleLoadingEnabled?: boolean
  messages: SessionMessage[]
  todos?: { content: string; status: string }[]
  contextCompaction?: unknown
  isArchived?: boolean
  selectedStylePresetIds?: string[]
  initialStylePresetIds?: string[]
  initialSystemPromptSnapshot?: string | null
  bookTravelState?: unknown
}

const sessionMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent']),
  content: z.string(),
  thinking: z.string().optional(),
  thinkingBlocks: z.array(z.object({
    id: z.string(),
    content: z.string(),
    signature: z.string().optional(),
  })).optional(),
  tools: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    result: z.string(),
    status: z.string().optional(),
    arguments: z.string().optional(),
  })).optional(),
  articleType: z.string().optional(),
  suggestedChoices: z.array(z.string()).optional(),
})

/** Durable session record schema (validated at the storage boundary). */
export const sessionRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  savedAt: z.number(),
  sessionKind: z.enum(['chat', 'story', 'bookTravel']).optional(),
  characterCardId: z.string().nullable().optional(),
  characterCardIds: z.array(z.string()).nullable().optional(),
  selectedWorldBookId: z.string().nullable().optional(),
  dynamicRoleLoadingEnabled: z.boolean().optional(),
  messages: z.array(sessionMessageSchema).default([]),
  todos: z.array(z.object({ content: z.string(), status: z.string() })).optional(),
  contextCompaction: z.unknown().optional(),
  isArchived: z.boolean().optional(),
  selectedStylePresetIds: z.array(z.string()).optional(),
  initialStylePresetIds: z.array(z.string()).optional(),
  initialSystemPromptSnapshot: z.string().nullable().optional(),
  bookTravelState: z.unknown().optional(),
})

/** Durable store-envelope schema. */
export const storeBlobSchema = z.object({
  state: z.record(z.string(), z.unknown()),
  version: z.number(),
})

/** The `museai` domain declaration. */
export const museaiDomainSpec = defineDomain({
  name: 'museai',
  version: 1,
  tables: {
    store: domainTable<StoreKey, StoreBlob>(storeBlobSchema),
    sessions: domainTable<string, SessionRecord>(sessionRecordSchema),
  },
})

/** Session table key: `"<kind>:<id>"`. */
export function sessionKey(kind: SessionKind, id: string): string {
  return `${kind}:${id}`
}

/** Split a session table key back into kind and id; null when malformed. */
export function parseSessionKey(key: string): { kind: SessionKind; id: string } | null {
  const sepIndex = key.indexOf(':')
  if (sepIndex <= 0) return null
  const kind = key.slice(0, sepIndex) as SessionKind
  if (!SESSION_KINDS.includes(kind)) return null
  return { kind, id: key.slice(sepIndex + 1) }
}

/**
 * The `museaiStore` service face: synchronous reads from authoritative
 * memory, asynchronous durable writes. Route handlers and the browser half
 * never touch the domain or the memory maps directly.
 */
export interface MuseaiStore {
  /** Domain-backed when the storage domain opened, memory-backed otherwise. */
  readonly durable: boolean
  getStore(key: StoreKey): StoreBlob | undefined
  putStore(key: StoreKey, value: StoreBlob): Promise<void>
  listSessions(kind: SessionKind): SessionRecord[]
  getSession(kind: SessionKind, id: string): SessionRecord | undefined
  putSession(kind: SessionKind, record: SessionRecord): Promise<void>
  deleteSession(kind: SessionKind, id: string): Promise<boolean>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** MuseAI store service (domain-backed or memory fallback). */
    museaiStore: MuseaiStore
  }
}

/** Memory-backed implementation used before/without the storage domain. */
class MemoryMuseaiStore implements MuseaiStore {
  readonly durable = false
  private readonly storeBlobs = new Map<StoreKey, StoreBlob>()
  private readonly sessions = new Map<string, SessionRecord>()

  getStore(key: StoreKey): StoreBlob | undefined {
    return this.storeBlobs.get(key)
  }

  async putStore(key: StoreKey, value: StoreBlob): Promise<void> {
    this.storeBlobs.set(key, value)
  }

  listSessions(kind: SessionKind): SessionRecord[] {
    const records: SessionRecord[] = []
    for (const [key, record] of this.sessions) {
      const parsed = parseSessionKey(key)
      if (parsed !== null && parsed.kind === kind) records.push(record)
    }
    return records.sort((a, b) => b.savedAt - a.savedAt)
  }

  getSession(kind: SessionKind, id: string): SessionRecord | undefined {
    return this.sessions.get(sessionKey(kind, id))
  }

  async putSession(kind: SessionKind, record: SessionRecord): Promise<void> {
    this.sessions.set(sessionKey(kind, record.id), record)
  }

  async deleteSession(kind: SessionKind, id: string): Promise<boolean> {
    return this.sessions.delete(sessionKey(kind, id))
  }

  /** Snapshot the memory contents for the upgrade flush. */
  snapshot(): { storeBlobs: [StoreKey, StoreBlob][]; sessions: [string, SessionRecord][] } {
    return {
      storeBlobs: [...this.storeBlobs.entries()],
      sessions: [...this.sessions.entries()],
    }
  }
}

/** Domain-backed implementation over the opened `museai` domain. */
class DomainMuseaiStore implements MuseaiStore {
  readonly durable = true
  private readonly storeTable: ReturnType<Domain<typeof museaiDomainSpec>['table']>
  private readonly sessionTable: ReturnType<Domain<typeof museaiDomainSpec>['table']>

  constructor(private readonly domain: Domain<typeof museaiDomainSpec>) {
    this.storeTable = domain.table('store')
    this.sessionTable = domain.table('sessions')
  }

  getStore(key: StoreKey): StoreBlob | undefined {
    return this.storeTable.get(key)
  }

  async putStore(key: StoreKey, value: StoreBlob): Promise<void> {
    await this.storeTable.put(key, value)
  }

  listSessions(kind: SessionKind): SessionRecord[] {
    const records: SessionRecord[] = []
    for (const [key, record] of this.sessionTable.entries()) {
      const parsed = parseSessionKey(key)
      if (parsed !== null && parsed.kind === kind) records.push(record)
    }
    return records.sort((a, b) => b.savedAt - a.savedAt)
  }

  getSession(kind: SessionKind, id: string): SessionRecord | undefined {
    return this.sessionTable.get(sessionKey(kind, id))
  }

  async putSession(kind: SessionKind, record: SessionRecord): Promise<void> {
    await this.sessionTable.put(sessionKey(kind, record.id), record)
  }

  async deleteSession(kind: SessionKind, id: string): Promise<boolean> {
    return this.sessionTable.delete(sessionKey(kind, id))
  }
}

/**
 * The facade service: starts memory-backed and upgrades to the domain once it
 * opens. Every method delegates to the current backend; the upgrade swaps the
 * backend after flushing the memory snapshot into the domain.
 */
class StoreFacade implements MuseaiStore {
  private memory = new MemoryMuseaiStore()
  private domainStore: DomainMuseaiStore | null = null

  get durable(): boolean {
    return this.domainStore !== null
  }

  private backend(): MuseaiStore {
    return this.domainStore ?? this.memory
  }

  getStore(key: StoreKey): StoreBlob | undefined {
    return this.backend().getStore(key)
  }

  async putStore(key: StoreKey, value: StoreBlob): Promise<void> {
    await this.backend().putStore(key, value)
  }

  listSessions(kind: SessionKind): SessionRecord[] {
    return this.backend().listSessions(kind)
  }

  getSession(kind: SessionKind, id: string): SessionRecord | undefined {
    return this.backend().getSession(kind, id)
  }

  async putSession(kind: SessionKind, record: SessionRecord): Promise<void> {
    await this.backend().putSession(kind, record)
  }

  async deleteSession(kind: SessionKind, id: string): Promise<boolean> {
    return this.backend().deleteSession(kind, id)
  }

  /**
   * Upgrade to the opened domain: flush memory contents into the domain
   * tables, then swap the backend. Idempotent (a second call with a domain
   * already active is a no-op).
   * @param domain - the opened museai domain.
   */
  async upgrade(domain: Domain<typeof museaiDomainSpec>): Promise<void> {
    if (this.domainStore !== null) return
    const next = new DomainMuseaiStore(domain)
    const { storeBlobs, sessions } = this.memory.snapshot()
    for (const [key, blob] of storeBlobs) {
      await next.putStore(key, blob)
    }
    for (const [key, record] of sessions) {
      const parsed = parseSessionKey(key)
      if (parsed !== null) await next.putSession(parsed.kind, record)
    }
    this.domainStore = next
    this.memory = new MemoryMuseaiStore()
  }
}

/**
 * Create the `museaiStore` service: memory-backed immediately, upgraded to
 * the storage domain as soon as the storage-domain facility mounts (nested
 * inject fiber — the form activates late in the composition). When the
 * facility is already present the fiber resolves at once.
 * @param ctx - host context.
 * @returns the store service facade.
 */
export function createMuseaiStore(ctx: Context): MuseaiStore {
  const facade = new StoreFacade()
  let warned = false
  const warnFallback = (): void => {
    if (warned) return
    warned = true
    ctx.logger.warn('museai: storage domain facility absent — keeping the in-memory store (data is not persisted)')
  }
  // Immediate attempt: the facility may already be mounted.
  const existing = ctx.get('storageDomain')
  if (existing !== undefined) {
    void openInto(ctx, facade, existing, warnFallback)
  } else {
    warnFallback()
  }
  // Upgrade fiber: fires the moment the facility mounts (or right away when
  // it was already mounted above and the open failed — it retries once).
  ctx.inject(['storageDomain'], (scope: Context) => {
    void openInto(scope, facade, scope.storageDomain, warnFallback)
  })
  return facade
}

/** Open the domain through one facility and upgrade the facade on success. */
async function openInto(
  ctx: Context,
  facade: StoreFacade,
  facility: DomainFacility,
  warnFallback: () => void,
): Promise<void> {
  try {
    const domain = await facility.open(museaiDomainSpec)
    ctx.effect(() => () => { void domain.close() }, 'museai: domain lifecycle')
    await facade.upgrade(domain)
    ctx.logger.info('museai: opened storage domain "museai" (durable)')
  } catch (error) {
    warnFallback()
    ctx.logger.warn(
      'museai: failed to open storage domain (%s) — keeping the in-memory store (data is not persisted)',
      error instanceof Error ? error.message : String(error),
    )
  }
}
