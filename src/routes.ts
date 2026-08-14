/**
 * MuseAI routes half (`@yejiming/dsh-museai-tavern/routes`): the
 * `/plugins/museai` HTTP surface. A separate row from the main `museai` row
 * so the plugin keeps working in headless profiles (no webserver): the store
 * service and domain open live on the main row, and this row only activates
 * where `webServer` exists (nested inject; a permanently pending top-level
 * inject would break one-shot runs).
 *
 * Routes:
 * - `GET  /plugins/museai/models`            — DSH model catalog (providers ×
 *   models) plus the current default selection.
 * - `POST /plugins/museai/chat`              — streaming generation over
 *   `ctx.llm.stream`, NDJSON events (start/delta/thinking_delta/done/error/
 *   aborted). Follows the DSH default selection when `followDefault` is set.
 * - `POST /plugins/museai/complete`          — one-shot generation returning
 *   `{ text, reasoning }` JSON (titles, memory archiving, SillyTavern
 *   conversion, memory distillation).
 * - `GET/PUT /plugins/museai/store/<key>`    — one MuseAI store envelope.
 * - `GET /plugins/museai/sessions/<kind>`    — session summaries by kind.
 * - `GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id>` — one session.
 *
 * No credential ever appears on this surface: requests name provider/model
 * ids from the DSH catalog (or `followDefault`), and all authentication is
 * the harness's own.
 * @module @yejiming/dsh-museai-tavern/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  BlockAssembler,
  ReasoningEffortId,
  createAssistantMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import z from 'schemastery'
import { z as zod } from 'zod'
// Type-only: pulls the ctx.museaiStore merge (the main museai row) and the
// service faces of the webserver / llm / default-model into this program.
import type {} from './index.ts'
import type {} from './domain.ts'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'

/** Cordis plugin name (diagnostics only). */
export const name = 'museai-routes'

/**
 * No top-level `inject` export: the row must ACTIVATE even in headless
 * profiles where `webServer` never exists. The routes register through a
 * nested inject fiber the moment the webserver and the store are both
 * available.
 */
export const inject: string[] = []

/** Route prefix owned by this plugin (the browser half calls under it). */
export const MUSAI_PATH = '/plugins/museai'

/** Routes-half configuration (defaults mirror the main row). */
export interface Config {
  /** Deadline for one streaming chat request, milliseconds. */
  chatTimeoutMs: number
  /** Deadline for one non-streaming completion request, milliseconds. */
  completeTimeoutMs: number
  /** Deadline for the model-catalog interrogation, milliseconds. */
  modelsTimeoutMs: number
  /** In-memory cap on captured non-streaming output, characters. */
  maxCompleteChars: number
}

/** Loader schema with deployment defaults (no library defaults). */
export const Config = z.object({
  chatTimeoutMs: z.number().step(1).min(1000).default(120_000),
  completeTimeoutMs: z.number().step(1).min(1000).default(120_000),
  modelsTimeoutMs: z.number().step(1).min(1000).default(10_000),
  maxCompleteChars: z.number().step(1).min(256).default(20_000),
})

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/** One wire message of a chat/completion request. */
export interface WireMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Shared model-target part of a generation request. */
export interface ModelTarget {
  /** Use the DSH default model selection (provider/model resolved server-side). */
  followDefault?: boolean
  provider?: string
  model?: string
}

/** Streaming chat request body. */
export interface ChatRequestBody extends ModelTarget {
  system?: string
  messages: WireMessage[]
  temperature?: number
  maxTokens?: number
  thinkingDepth?: 'off' | 'low' | 'medium' | 'high'
}

/** One-shot completion request body. */
export interface CompleteRequestBody extends ModelTarget {
  system?: string
  messages: WireMessage[]
  temperature?: number
  maxTokens?: number
  thinkingDepth?: 'off' | 'low' | 'medium' | 'high'
}

/** NDJSON stream events emitted by /chat. */
export type ChatStreamEventWire =
  | { event: 'start'; runId: string }
  | { event: 'delta'; runId: string; delta: string }
  | { event: 'thinking_delta'; runId: string; delta: string }
  | { event: 'done'; runId: string; text: string; reasoning: string; usage?: unknown }
  | { event: 'error'; runId: string; message: string }
  | { event: 'aborted'; runId: string }

// ---------------------------------------------------------------------------
// Request validation (zod; schemas live next to the wire types)
// ---------------------------------------------------------------------------

const wireMessageSchema = zod.object({
  role: zod.enum(['user', 'assistant']),
  content: zod.string(),
})

const modelTargetSchema = zod.object({
  followDefault: zod.boolean().optional(),
  provider: zod.string().optional(),
  model: zod.string().optional(),
})

export const chatBodySchema = zod.object({
  followDefault: zod.boolean().optional(),
  provider: zod.string().optional(),
  model: zod.string().optional(),
  system: zod.string().optional(),
  messages: zod.array(wireMessageSchema).min(1),
  temperature: zod.number().optional(),
  maxTokens: zod.number().int().positive().optional(),
  thinkingDepth: zod.enum(['off', 'low', 'medium', 'high']).optional(),
})

export const completeBodySchema = chatBodySchema

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(new Error(`请求体不是合法 JSON: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Build the llm `Message[]` from wire messages (fresh identities each call). */
function toLlmMessages(messages: WireMessage[]): Message[] {
  return messages.map((message) => {
    const content = [{ type: 'text' as const, text: message.content }]
    if (message.role === 'user') {
      return createUserMessage({ content, source: { kind: 'user' } })
    }
    return createAssistantMessage({ content, source: { provider: 'museai', model: 'museai' } })
  })
}

/**
 * Resolve the effective provider/model for a request: the DSH default
 * selection when `followDefault` is set (or neither provider nor model was
 * given), else the explicit ids.
 * @param ctx - host context with the llm and default-model services.
 * @param target - validated request model target.
 * @returns the provider and model, or null when unresolvable.
 */
export function resolveModelTarget(
  ctx: Context,
  target: ModelTarget,
): { provider: string; model: string } | null {
  const explicit = target.provider !== undefined && target.model !== undefined
  if (!explicit || target.followDefault === true) {
    const current = ctx.agentDefaultModel.currentSelection()
    if (current === undefined) return null
    return { provider: current.provider, model: current.model }
  }
  return { provider: target.provider as string, model: target.model as string }
}

/** Assemble stream chunks into one text/reasoning result. */
export async function assemble(chunks: AsyncIterable<StreamChunk>): Promise<{
  text: string
  reasoning: string
  truncated: boolean
  usage?: unknown
}> {
  const assembler = new BlockAssembler()
  for await (const chunk of chunks) assembler.push(chunk)
  const blocks = assembler.blocks()
  const text = blocks
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim()
  const reasoning = blocks
    .filter((block): block is Extract<typeof block, { type: 'reasoning' }> => block.type === 'reasoning')
    .map((block) => block.text)
    .join(' ')
    .trim()
  return { text, reasoning, truncated: assembler.finish.kind === 'max-tokens', usage: assembler.usage }
}

/**
 * Validate the thinking depth against the exact model route; returns the
 * reasoning effort when supported (matching dsh-gomoku's fallback policy:
 * an unsupported effort is dropped, not fatal).
 */
async function resolveReasoningEffort(
  ctx: Context,
  provider: string,
  model: string,
  thinkingDepth: 'off' | 'low' | 'medium' | 'high' | undefined,
  signal: AbortSignal,
): Promise<ReasoningEffortId | undefined> {
  if (thinkingDepth === undefined || thinkingDepth === 'off') return undefined
  try {
    const info = await ctx.llm.resolveModelInfo(provider, model, signal)
    if (info.reasoning?.efforts.some((effort) => effort.id === thinkingDepth)) {
      return ReasoningEffortId(thinkingDepth)
    }
  } catch {
    // Unresolvable metadata — fall through to the model's own default.
  }
  return undefined
}

/** Assemble GenerateOptions from a validated body (shared by chat/complete). */
export async function buildGenerateOptions(
  ctx: Context,
  body: ChatRequestBody | CompleteRequestBody,
  signal: AbortSignal,
): Promise<GenerateOptions | null> {
  const target = resolveModelTarget(ctx, body)
  if (target === null) return null
  const reasoningEffort = await resolveReasoningEffort(ctx, target.provider, target.model, body.thinkingDepth, signal)
  const options: GenerateOptions = {
    provider: target.provider,
    model: target.model,
    messages: toLlmMessages(body.messages),
    ...(body.system !== undefined ? { system: body.system } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
    ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    signal,
  }
  return options
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /plugins/museai/models — the DSH model catalog + default selection. */
export async function handleModels(ctx: Context, res: ServerResponse, timeoutMs: number): Promise<void> {
  const groups: { provider: string; displayName: string; models: { id: string; name: string }[] }[] = []
  const failures: { provider: string; error: string }[] = []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('museai: 模型目录查询超时')), timeoutMs)
  try {
    for (const provider of ctx.llm.listProviders()) {
      let models: readonly LlmModelInfo[]
      try {
        models = await ctx.llm.listModels(provider.id)
      } catch (error) {
        failures.push({ provider: provider.id, error: error instanceof Error ? error.message : String(error) })
        continue
      }
      groups.push({
        provider: provider.id,
        displayName: provider.name,
        models: models.map((model) => ({ id: model.id, name: model.name })),
      })
    }
    let defaultSelection: { provider: string; model: string; reasoningEffort?: string } | null = null
    try {
      const current = ctx.agentDefaultModel.currentSelection()
      if (current !== undefined) {
        defaultSelection = {
          provider: current.provider,
          model: current.model,
          ...(current.reasoningEffort !== undefined ? { reasoningEffort: String(current.reasoningEffort) } : {}),
        }
      }
    } catch {
      // No default-model service — catalog still serves.
    }
    writeJson(res, 200, { groups, failures, defaultSelection })
  } finally {
    clearTimeout(timer)
  }
}

/** POST /plugins/museai/chat — streaming generation, NDJSON events. */
export async function handleChat(ctx: Context, req: IncomingMessage, res: ServerResponse, timeoutMs: number): Promise<void> {
  let body: ChatRequestBody
  try {
    body = chatBodySchema.parse(await readJson(req)) as ChatRequestBody
  } catch (error) {
    writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
    return
  }
  const runId = `museai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('museai: 生成超时')), timeoutMs)
  const detached = req.socket
  const onClose = (): void => controller.abort(new Error('client disconnected'))
  detached.on('close', onClose)

  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  })
  const emit = (event: ChatStreamEventWire): void => {
    res.write(`${JSON.stringify(event)}\n`)
  }

  emit({ event: 'start', runId })
  try {
    const options = await buildGenerateOptions(ctx, body, controller.signal)
    if (options === null) {
      emit({ event: 'error', runId, message: 'museai: 无法解析模型（未指定 provider/model 且 DSH 无默认模型）' })
      return
    }
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream(options)) {
      controller.signal.throwIfAborted()
      if (chunk.type === 'text-delta' && chunk.text.length > 0) {
        emit({ event: 'delta', runId, delta: chunk.text })
      } else if (chunk.type === 'reasoning-delta' && chunk.text.length > 0) {
        emit({ event: 'thinking_delta', runId, delta: chunk.text })
      }
      assembler.push(chunk)
    }
    const blocks = assembler.blocks()
    const text = blocks
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim()
    const reasoning = blocks
      .filter((block): block is Extract<typeof block, { type: 'reasoning' }> => block.type === 'reasoning')
      .map((block) => block.text)
      .join(' ')
      .trim()
    emit({
      event: 'done',
      runId,
      text,
      reasoning,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      emit({ event: 'aborted', runId })
    } else {
      emit({ event: 'error', runId, message: error instanceof Error ? error.message : String(error) })
    }
  } finally {
    clearTimeout(timer)
    detached.removeListener('close', onClose)
    res.end()
  }
}

/** POST /plugins/museai/complete — one-shot generation, JSON response. */
export async function handleComplete(ctx: Context, req: IncomingMessage, res: ServerResponse, timeoutMs: number): Promise<void> {
  let body: CompleteRequestBody
  try {
    body = completeBodySchema.parse(await readJson(req)) as CompleteRequestBody
  } catch (error) {
    writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('museai: 生成超时')), timeoutMs)
  try {
    const options = await buildGenerateOptions(ctx, body, controller.signal)
    if (options === null) {
      writeJson(res, 400, { error: 'museai: 无法解析模型（未指定 provider/model 且 DSH 无默认模型）' })
      return
    }
    const { text, reasoning } = await assemble(ctx.llm.stream(options))
    writeJson(res, 200, { text, reasoning })
  } catch (error) {
    writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Store + session routes
// ---------------------------------------------------------------------------

const STORE_KEY_SET = new Set(['settings', 'partners', 'partnerChat', 'story', 'stylePresets', 'agent'])
const SESSION_KIND_SET = new Set(['partner', 'story'])

/** GET/PUT /plugins/museai/store/<key> */
export async function handleStore(ctx: Context, req: IncomingMessage, res: ServerResponse, key: string): Promise<void> {
  if (!STORE_KEY_SET.has(key)) {
    writeJson(res, 404, { error: `未知 store key: ${key}` })
    return
  }
  const storeKey = key as 'settings' | 'partners' | 'partnerChat' | 'story' | 'stylePresets'
  if (req.method === 'GET') {
    const blob = ctx.museaiStore.getStore(storeKey)
    if (blob === undefined) {
      writeJson(res, 200, { state: {}, version: 0 })
      return
    }
    writeJson(res, 200, blob)
    return
  }
  if (req.method === 'PUT') {
    let raw: unknown
    try {
      raw = await readJson(req)
    } catch (error) {
      writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      return
    }
    const parsed = zod.object({
      state: zod.record(zod.string(), zod.unknown()),
      version: zod.number(),
    }).safeParse(raw)
    if (!parsed.success) {
      writeJson(res, 400, { error: 'store 记录格式非法（需要 { state, version }）' })
      return
    }
    await ctx.museaiStore.putStore(storeKey, parsed.data)
    writeJson(res, 200, { ok: true })
    return
  }
  writeJson(res, 405, { error: 'method not allowed' })
}

/** GET /plugins/museai/sessions/<kind> */
export async function handleSessionList(ctx: Context, res: ServerResponse, kind: string): Promise<void> {
  if (!SESSION_KIND_SET.has(kind)) {
    writeJson(res, 404, { error: `未知会话类型: ${kind}` })
    return
  }
  const kindTyped = kind as 'partner' | 'story'
  const records = ctx.museaiStore.listSessions(kindTyped)
  const summaries = records.map((record) => ({
    id: record.id,
    title: record.title,
    savedAt: record.savedAt,
    sessionKind: record.sessionKind,
    characterCardId: record.characterCardId ?? null,
    characterCardIds: record.characterCardIds ?? null,
    selectedWorldBookId: record.selectedWorldBookId ?? null,
    dynamicRoleLoadingEnabled: record.dynamicRoleLoadingEnabled ?? false,
    messageCount: record.messages.length,
  }))
  writeJson(res, 200, { sessions: summaries })
}

/** GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id> */
export async function handleSession(ctx: Context, req: IncomingMessage, res: ServerResponse, kind: string, id: string): Promise<void> {
  if (!SESSION_KIND_SET.has(kind)) {
    writeJson(res, 404, { error: `未知会话类型: ${kind}` })
    return
  }
  const kindTyped = kind as 'partner' | 'story'
  if (req.method === 'GET') {
    const record = ctx.museaiStore.getSession(kindTyped, id)
    if (record === undefined) {
      writeJson(res, 404, { error: `会话不存在: ${id}` })
      return
    }
    writeJson(res, 200, record)
    return
  }
  if (req.method === 'PUT') {
    let raw: unknown
    try {
      raw = await readJson(req)
    } catch (error) {
      writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      return
    }
    const parsed = zod.object({
      id: zod.string(),
      title: zod.string(),
      savedAt: zod.number(),
      sessionKind: zod.enum(['chat', 'story', 'bookTravel']).optional(),
      characterCardId: zod.string().nullable().optional(),
      characterCardIds: zod.array(zod.string()).nullable().optional(),
      selectedWorldBookId: zod.string().nullable().optional(),
      dynamicRoleLoadingEnabled: zod.boolean().optional(),
      messages: zod.array(zod.unknown()).default([]),
      todos: zod.array(zod.unknown()).optional(),
      contextCompaction: zod.unknown().optional(),
      isArchived: zod.boolean().optional(),
      selectedStylePresetIds: zod.array(zod.string()).optional(),
      initialStylePresetIds: zod.array(zod.string()).optional(),
      initialSystemPromptSnapshot: zod.string().nullable().optional(),
      bookTravelState: zod.unknown().optional(),
    }).safeParse(raw)
    if (!parsed.success) {
      writeJson(res, 400, { error: '会话记录格式非法' })
      return
    }
    if (parsed.data.id !== id) {
      writeJson(res, 400, { error: '会话 id 与路径不一致' })
      return
    }
    await ctx.museaiStore.putSession(kindTyped, parsed.data as never)
    writeJson(res, 200, { ok: true })
    return
  }
  if (req.method === 'DELETE') {
    const removed = await ctx.museaiStore.deleteSession(kindTyped, id)
    writeJson(res, 200, { ok: removed })
    return
  }
  writeJson(res, 405, { error: 'method not allowed' })
}

// ---------------------------------------------------------------------------
// Plugin body
// ---------------------------------------------------------------------------

/**
 * Mount the museai routes the moment the webserver and the store service are
 * both available; headless profiles simply never reach this fiber.
 * @param ctx - host cordis context.
 * @param config - validated loader configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved: Required<Config> = {
    chatTimeoutMs: config.chatTimeoutMs,
    completeTimeoutMs: config.completeTimeoutMs,
    modelsTimeoutMs: config.modelsTimeoutMs,
    maxCompleteChars: config.maxCompleteChars,
  }
  void resolved
  ctx.inject(['webServer', 'llm', 'agentDefaultModel', 'museaiStore'], (scope: Context) => {
    const dispose = scope.webServer.register({
      kind: 'prefix',
      path: MUSAI_PATH,
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          try {
            const url = new URL(req.url ?? '/', 'http://museai.internal')
            const segments = url.pathname.slice(MUSAI_PATH.length).split('/').filter(Boolean)
            if (req.method === 'GET' && segments.length === 1 && segments[0] === 'models') {
              await handleModels(scope, res, config.modelsTimeoutMs)
              return
            }
            if (req.method === 'POST' && segments.length === 1 && segments[0] === 'chat') {
              await handleChat(scope, req, res, config.chatTimeoutMs)
              return
            }
            if (req.method === 'POST' && segments.length === 1 && segments[0] === 'complete') {
              await handleComplete(scope, req, res, config.completeTimeoutMs)
              return
            }
            if (segments.length === 2 && segments[0] === 'store') {
              await handleStore(scope, req, res, decodeURIComponent(segments[1]))
              return
            }
            if (segments.length === 2 && segments[0] === 'sessions') {
              await handleSessionList(scope, res, decodeURIComponent(segments[1]))
              return
            }
            if (segments.length === 3 && segments[0] === 'sessions') {
              await handleSession(scope, req, res, decodeURIComponent(segments[1]), decodeURIComponent(segments[2]))
              return
            }
            writeJson(res, 404, { error: 'not found' })
          } catch (error) {
            writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        })()
      },
    })
    scope.effect(() => () => { dispose() }, 'museai: routes')
  })
}
