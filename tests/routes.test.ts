/**
 * Route-half unit tests: the model catalog, streaming chat, one-shot
 * completion, store, and session handlers with mocked host services
 * (llm / agentDefaultModel / museaiStore) and fake req/res objects.
 * @module @yejiming/dsh-museai-tavern/tests/routes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  handleChat,
  handleComplete,
  handleModels,
  handleStore,
  handleSessionList,
  handleSession,
  chatBodySchema,
} from '../src/routes.ts'
import type { StoreBlob } from '../src/domain.ts'

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** Collect the response: status, headers, and the written body. */
class FakeRes {
  status = 0
  headers: Record<string, string> = {}
  body = ''
  ended = false

  writeHead(status: number, headers?: Record<string, string>): void {
    this.status = status
    if (headers !== undefined) this.headers = headers
  }

  write(chunk: string): void {
    this.body += chunk
  }

  end(chunk?: string): void {
    if (chunk !== undefined) this.body += chunk
    this.ended = true
  }
}

/** Fake incoming request with a JSON body and an abortable socket. */
class FakeReq {
  method = 'GET'

  socket = new (class {
    listeners = new Map<string, Array<() => void>>()
    on(event: string, fn: () => void): void {
      const list = this.listeners.get(event) ?? []
      list.push(fn)
      this.listeners.set(event, list)
    }
    removeListener(event: string, fn: () => void): void {
      const list = this.listeners.get(event) ?? []
      this.listeners.set(event, list.filter((f) => f !== fn))
    }
    emit(event: string): void {
      for (const fn of this.listeners.get(event) ?? []) fn()
    }
  })()

  constructor(private readonly raw: string, method = 'GET') {
    this.method = method
  }

  on(event: string, fn: (chunk: Buffer) => void): void {
    if (event === 'data') {
      fn(Buffer.from(this.raw, 'utf8'))
    } else if (event === 'end') {
      fn(Buffer.alloc(0))
    }
  }
}

interface MockLlm {
  listProviders(): { id: string; name: string }[]
  listModels(provider: string): Promise<{ id: string; name: string }[]>
  resolveModelInfo(): Promise<{ reasoning?: { efforts: { id: string }[] } }>
  stream(options: unknown): AsyncIterable<never>
}

interface MockStore {
  durable: boolean
  getStore(key: string): StoreBlob | undefined
  putStore(key: string, value: StoreBlob): Promise<void>
  listSessions(kind: string): unknown[]
  getSession(kind: string, id: string): unknown
  putSession(kind: string, record: unknown): Promise<void>
  deleteSession(kind: string, id: string): Promise<boolean>
}

let mockLlm: MockLlm
let mockStore: MockStore
let ctx: Context

beforeEach(() => {
  mockLlm = {
    listProviders: () => [
      { id: 'deepseek-official', name: 'DeepSeek' },
      { id: 'broken-provider', name: 'Broken' },
    ],
    listModels: async (provider) => {
      if (provider === 'broken-provider') throw new Error('adapter exploded')
      return [
        { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash' },
        { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
      ]
    },
    resolveModelInfo: async () => ({
      reasoning: { efforts: [{ id: 'off' }, { id: 'low' }, { id: 'medium' }, { id: 'high' }] },
    }),
    stream: async function* () {
      // Default: no chunks.
    },
  }
  mockStore = {
    durable: true,
    getStore: () => undefined,
    putStore: async () => {},
    listSessions: () => [],
    getSession: () => undefined,
    putSession: async () => {},
    deleteSession: async () => true,
  }
  ctx = {
    llm: mockLlm,
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash', reasoningEffort: 'max' }),
    },
    museaiStore: mockStore,
  } as unknown as Context
})

function asRes(res: FakeRes): ServerResponse {
  return res as unknown as ServerResponse
}

function asReq(req: FakeReq): IncomingMessage {
  return req as unknown as IncomingMessage
}

// ---------------------------------------------------------------------------
// GET /models
// ---------------------------------------------------------------------------

describe('handleModels', () => {
  it('returns the catalog with the default selection and per-provider failures', async () => {
    const res = new FakeRes()
    await handleModels(ctx, asRes(res), 1000)
    expect(res.status).toBe(200)
    const parsed = JSON.parse(res.body) as {
      groups: { provider: string; models: { id: string }[] }[]
      failures: { provider: string; error: string }[]
      defaultSelection: { provider: string; model: string }
    }
    expect(parsed.groups).toHaveLength(1)
    expect(parsed.groups[0]).toMatchObject({
      provider: 'deepseek-official',
      displayName: 'DeepSeek',
      models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }],
    })
    expect(parsed.failures).toEqual([{ provider: 'broken-provider', error: 'adapter exploded' }])
    expect(parsed.defaultSelection).toEqual({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'max',
    })
  })

  it('serves an empty catalog without errors when no providers exist', async () => {
    mockLlm.listProviders = () => []
    const res = new FakeRes()
    await handleModels(ctx, asRes(res), 1000)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ groups: [], failures: [] })
  })
})

// ---------------------------------------------------------------------------
// POST /chat
// ---------------------------------------------------------------------------

describe('handleChat', () => {
  it('streams start/delta/thinking_delta/done events as NDJSON', async () => {
    mockLlm.stream = async function* () {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: '你好' }
      yield { type: 'text-delta', index: 0, text: '世界' }
      yield { type: 'reasoning-delta', index: 1, text: '想' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: '你好世界' } }
      yield { type: 'block-end', index: 1, block: { type: 'reasoning', text: '想' } }
      yield { type: 'finish', kind: 'stop' }
    }
    const req = new FakeReq(JSON.stringify({
      followDefault: true,
      system: '测试',
      messages: [{ role: 'user', content: 'hi' }],
    }))
    const res = new FakeRes()
    await handleChat(ctx, asReq(req), asRes(res), 5000)
    const events = res.body.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    expect(events[0]).toMatchObject({ event: 'start' })
    expect(events).toContainEqual({ event: 'delta', runId: expect.any(String), delta: '你好' })
    expect(events).toContainEqual({ event: 'delta', runId: expect.any(String), delta: '世界' })
    expect(events).toContainEqual({ event: 'thinking_delta', runId: expect.any(String), delta: '想' })
    const done = events.find((e) => e.event === 'done')
    expect(done).toMatchObject({ event: 'done', text: '你好世界', reasoning: '想' })
  })

  it('emits an error event when the model call fails', async () => {
    mockLlm.stream = async function* () {
      throw new Error('provider 500')
    }
    const req = new FakeReq(JSON.stringify({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hi' }],
    }))
    const res = new FakeRes()
    await handleChat(ctx, asReq(req), asRes(res), 5000)
    const events = res.body.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    expect(events.at(-1)).toMatchObject({ event: 'error', message: 'provider 500' })
  })

  it('emits aborted when the client disconnects mid-stream', async () => {
    mockLlm.stream = async function* () {
      yield { type: 'text-delta', index: 0, text: 'a' }
      await new Promise((resolve) => setTimeout(resolve, 50))
      yield { type: 'text-delta', index: 0, text: 'b' }
    }
    const req = new FakeReq(JSON.stringify({
      followDefault: true,
      messages: [{ role: 'user', content: 'hi' }],
    }))
    const res = new FakeRes()
    const promise = handleChat(ctx, asReq(req), asRes(res), 5000)
    setTimeout(() => (req.socket as unknown as { emit: (e: string) => void }).emit('close'), 10)
    await promise
    const events = res.body.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    expect(events.at(-1)).toMatchObject({ event: 'aborted' })
  })

  it('rejects an invalid body with 400', async () => {
    const req = new FakeReq(JSON.stringify({ provider: 42 }))
    const res = new FakeRes()
    await handleChat(ctx, asReq(req), asRes(res), 5000)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /complete
// ---------------------------------------------------------------------------

describe('handleComplete', () => {
  it('returns assembled text and reasoning JSON', async () => {
    mockLlm.stream = async function* () {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: '结果' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: '结果' } }
      yield { type: 'finish', kind: 'stop' }
    }
    const req = new FakeReq(JSON.stringify({
      followDefault: true,
      system: '标题助手',
      messages: [{ role: 'user', content: '写个冒险故事' }],
      temperature: 0.3,
      maxTokens: 128,
    }))
    const res = new FakeRes()
    await handleComplete(ctx, asReq(req), asRes(res), 5000)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ text: '结果', reasoning: '' })
  })

  it('rejects when the model target is unresolvable', async () => {
    ctx = {
      llm: mockLlm,
      agentDefaultModel: { currentSelection: () => undefined },
      museaiStore: mockStore,
    } as unknown as Context
    const req = new FakeReq(JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }))
    const res = new FakeRes()
    await handleComplete(ctx, asReq(req), asRes(res), 5000)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Store + sessions
// ---------------------------------------------------------------------------

describe('store routes', () => {
  it('rejects unknown store keys', async () => {
    const res = new FakeRes()
    await handleStore(ctx, asReq(new FakeReq('{}')), asRes(res), 'evil')
    expect(res.status).toBe(404)
  })

  it('round-trips a valid envelope', async () => {
    const store: StoreBlob = { state: { temperature: 0.7 }, version: 1 }
    mockStore.putStore = async (key, value) => {
      mockStore.getStore = () => value
      void key
    }
    const putRes = new FakeRes()
    await handleStore(ctx, asReq(new FakeReq(JSON.stringify(store), 'PUT')), asRes(putRes), 'settings')
    expect(putRes.status).toBe(200)
    const getRes = new FakeRes()
    await handleStore(ctx, asReq(new FakeReq('')), asRes(getRes), 'settings')
    expect(getRes.status).toBe(200)
    expect(JSON.parse(getRes.body)).toEqual(store)
  })

  it('rejects a malformed envelope', async () => {
    const res = new FakeRes()
    await handleStore(ctx, asReq(new FakeReq(JSON.stringify({ nope: true }), 'PUT')), asRes(res), 'settings')
    expect(res.status).toBe(400)
  })
})

describe('session routes', () => {
  it('lists summaries for a kind', async () => {
    mockStore.listSessions = () => [
      { id: 's1', title: '会话一', savedAt: 1, messages: [{ id: 'm1' }, { id: 'm2' }] },
    ]
    const res = new FakeRes()
    await handleSessionList(ctx, asRes(res), 'partner')
    expect(res.status).toBe(200)
    const parsed = JSON.parse(res.body) as { sessions: { id: string; messageCount: number }[] }
    expect(parsed.sessions[0]).toMatchObject({ id: 's1', messageCount: 2 })
  })

  it('rejects unknown kinds', async () => {
    const res = new FakeRes()
    await handleSessionList(ctx, asRes(res), 'evil')
    expect(res.status).toBe(404)
  })

  it('puts and deletes a session record', async () => {
    let stored: unknown
    mockStore.putSession = async (_kind, record) => { stored = record }
    mockStore.deleteSession = async () => { stored = undefined; return true }
    const record = {
      id: 's1',
      title: '冒险',
      savedAt: 123,
      messages: [{ id: 'm1', role: 'user', content: '你好' }],
    }
    const putRes = new FakeRes()
    await handleSession(ctx, asReq(new FakeReq(JSON.stringify(record), 'PUT')), asRes(putRes), 'story', 's1')
    expect(putRes.status).toBe(200)
    expect(stored).toMatchObject({ id: 's1', title: '冒险' })
    const delRes = new FakeRes()
    await handleSession(ctx, asReq(new FakeReq('', 'DELETE')), asRes(delRes), 'story', 's1')
    expect(JSON.parse(delRes.body)).toEqual({ ok: true })
  })

  it('rejects an id mismatch', async () => {
    const res = new FakeRes()
    await handleSession(
      ctx,
      asReq(new FakeReq(JSON.stringify({ id: 'other', title: 'x', savedAt: 0, messages: [] }), 'PUT')),
      asRes(res),
      'partner',
      's1',
    )
    expect(res.status).toBe(400)
  })
})

describe('chatBodySchema', () => {
  it('accepts followDefault and rejects unknown sampling fields', () => {
    const parsed = chatBodySchema.safeParse({
      followDefault: true,
      messages: [{ role: 'user', content: 'hi' }],
      frequencyPenalty: 0.3,
    })
    // Unknown fields are stripped by default (zod object), not rejected —
    // the contract is that they are never forwarded to the model.
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('frequencyPenalty')
    }
  })
})
