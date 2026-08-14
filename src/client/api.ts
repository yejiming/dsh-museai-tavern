/**
 * Browser half of the museai model/store bridge: plain fetch calls against
 * `/plugins/museai/*`. No credentials ever appear here — requests name
 * provider/model ids from the DSH catalog or ask the server to follow the
 * DSH default selection.
 * @module @yejiming/dsh-museai-tavern/client/api
 */

/** Route prefix owned by the server half. */
const BASE = '/plugins/museai'

/** One DSH model-catalog group. */
export interface ModelGroupWire {
  provider: string
  displayName: string
  models: { id: string; name: string }[]
}

/** One DSH model-catalog query failure. */
export interface ModelFailureWire {
  provider: string
  error: string
}

/** The DSH default model selection, when one exists. */
export interface DefaultSelectionWire {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Model-catalog response of GET /plugins/museai/models. */
export interface ModelsResponseWire {
  groups: ModelGroupWire[]
  failures: ModelFailureWire[]
  defaultSelection: DefaultSelectionWire | null
}

/** Wire message of a chat/completion request. */
export interface WireMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Model target of a generation request: follow the DSH default or name ids. */
export type ModelTargetWire =
  | { followDefault: true }
  | { followDefault?: false; provider: string; model: string }

/** Streaming chat request body (union of the model target plus the payload). */
export type ChatRequestWire = ModelTargetWire & {
  system?: string
  messages: WireMessage[]
  temperature?: number
  maxTokens?: number
  thinkingDepth?: 'off' | 'low' | 'medium' | 'high'
}

/** NDJSON events emitted by /chat (subset the pages consume). */
export type ChatStreamEventWire =
  | { event: 'start'; runId: string }
  | { event: 'delta'; runId: string; delta: string }
  | { event: 'thinking_delta'; runId: string; delta: string }
  | { event: 'done'; runId: string; text: string; reasoning: string }
  | { event: 'error'; runId: string; message: string }
  | { event: 'aborted'; runId: string }

/** One-shot completion response. */
export interface CompleteResponseWire {
  text: string
  reasoning: string
}

/** zustand persist envelope as stored server-side. */
export interface StoreBlobWire {
  state: Record<string, unknown>
  version: number
}

/** Session record wire shape (subset the pages persist). */
export interface SessionRecordWire {
  id: string
  title: string
  savedAt: number
  sessionKind?: 'chat' | 'story' | 'bookTravel'
  characterCardId?: string | null
  characterCardIds?: string[] | null
  selectedWorldBookId?: string | null
  dynamicRoleLoadingEnabled?: boolean
  messages: {
    id: string
    role: 'user' | 'agent'
    content: string
    thinking?: string
    thinkingBlocks?: { id: string; content: string; signature?: string }[]
    tools?: { id?: string; name: string; result: string; status?: string; arguments?: string }[]
    articleType?: string
    suggestedChoices?: string[]
  }[]
  todos?: { content: string; status: string }[]
  contextCompaction?: unknown
  isArchived?: boolean
  selectedStylePresetIds?: string[]
  initialStylePresetIds?: string[]
  initialSystemPromptSnapshot?: string | null
  bookTravelState?: unknown
}

/** Session summary wire shape of GET /sessions/<kind>. */
export interface SessionSummaryWire {
  id: string
  title: string
  savedAt: number
  sessionKind?: 'chat' | 'story' | 'bookTravel'
  characterCardId?: string | null
  characterCardIds?: string[] | null
  selectedWorldBookId?: string | null
  dynamicRoleLoadingEnabled?: boolean
  messageCount: number
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    throw new Error(`museai: 非 JSON 响应 (${response.status})`)
  }
  if (!response.ok) {
    const message = (parsed as { error?: string } | null)?.error ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return parsed as T
}

/** GET /plugins/museai/models — the DSH model catalog + default selection. */
export async function fetchModels(): Promise<ModelsResponseWire> {
  return readJson<ModelsResponseWire>(await fetch(`${BASE}/models`))
}

/**
 * POST /plugins/museai/chat — streaming generation over NDJSON events.
 * @param request - the validated request body.
 * @param onEvent - called for every stream event.
 * @param signal - abort to stop generation (the server terminates the model
 * call and emits `aborted`).
 */
export async function streamChat(
  request: ChatRequestWire,
  onEvent: (event: ChatStreamEventWire) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || response.body === null) {
    throw new Error(`museai: chat 请求失败 (HTTP ${response.status})`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line.length > 0) {
        try {
          onEvent(JSON.parse(line) as ChatStreamEventWire)
        } catch {
          // Ignore malformed lines; the server never emits them.
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }
}

/** POST /plugins/museai/complete — one-shot generation returning JSON. */
export async function complete(
  request: ChatRequestWire,
): Promise<CompleteResponseWire> {
  return readJson<CompleteResponseWire>(await fetch(`${BASE}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  }))
}

/** GET /plugins/museai/store/<key> — one store envelope. */
export async function getStore(key: string): Promise<StoreBlobWire> {
  return readJson<StoreBlobWire>(await fetch(`${BASE}/store/${encodeURIComponent(key)}`))
}

/** PUT /plugins/museai/store/<key> — write one store envelope. */
export async function putStore(key: string, blob: StoreBlobWire): Promise<void> {
  await readJson<{ ok: boolean }>(await fetch(`${BASE}/store/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(blob),
  }))
}

/** GET /plugins/museai/sessions/<kind> — session summaries. */
export async function listSessions(kind: 'partner' | 'story'): Promise<SessionSummaryWire[]> {
  const parsed = await readJson<{ sessions: SessionSummaryWire[] }>(
    await fetch(`${BASE}/sessions/${kind}`),
  )
  return parsed.sessions
}

/** GET /plugins/museai/sessions/<kind>/<id> — one full session record. */
export async function loadSession(kind: 'partner' | 'story', id: string): Promise<SessionRecordWire> {
  return readJson<SessionRecordWire>(
    await fetch(`${BASE}/sessions/${kind}/${encodeURIComponent(id)}`),
  )
}

/** PUT /plugins/museai/sessions/<kind>/<id> — save one session record. */
export async function saveSession(kind: 'partner' | 'story', record: SessionRecordWire): Promise<void> {
  await readJson<{ ok: boolean }>(await fetch(`${BASE}/sessions/${kind}/${encodeURIComponent(record.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(record),
  }))
}

/** DELETE /plugins/museai/sessions/<kind>/<id> — remove one session record. */
export async function deleteSession(kind: 'partner' | 'story', id: string): Promise<boolean> {
  const parsed = await readJson<{ ok: boolean }>(
    await fetch(`${BASE}/sessions/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  )
  return parsed.ok
}

/** Whether the server half is reachable (used for offline fallback decisions). */
export async function pingModels(): Promise<boolean> {
  try {
    await fetchModels()
    return true
  } catch {
    return false
  }
}
