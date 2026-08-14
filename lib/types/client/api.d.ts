/**
 * Browser half of the museai model/store bridge: plain fetch calls against
 * `/plugins/museai/*`. No credentials ever appear here — requests name
 * provider/model ids from the DSH catalog or ask the server to follow the
 * DSH default selection.
 * @module @yejiming/dsh-museai-tavern/client/api
 */
/** One DSH model-catalog group. */
export interface ModelGroupWire {
    provider: string;
    displayName: string;
    models: {
        id: string;
        name: string;
    }[];
}
/** One DSH model-catalog query failure. */
export interface ModelFailureWire {
    provider: string;
    error: string;
}
/** The DSH default model selection, when one exists. */
export interface DefaultSelectionWire {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** Model-catalog response of GET /plugins/museai/models. */
export interface ModelsResponseWire {
    groups: ModelGroupWire[];
    failures: ModelFailureWire[];
    defaultSelection: DefaultSelectionWire | null;
}
/** Wire message of a chat/completion request. */
export interface WireMessage {
    role: 'user' | 'assistant';
    content: string;
}
/** Model target of a generation request: follow the DSH default or name ids. */
export type ModelTargetWire = {
    followDefault: true;
} | {
    followDefault?: false;
    provider: string;
    model: string;
};
/** Streaming chat request body (union of the model target plus the payload). */
export type ChatRequestWire = ModelTargetWire & {
    system?: string;
    messages: WireMessage[];
    temperature?: number;
    maxTokens?: number;
    thinkingDepth?: 'off' | 'low' | 'medium' | 'high';
};
/** NDJSON events emitted by /chat (subset the pages consume). */
export type ChatStreamEventWire = {
    event: 'start';
    runId: string;
} | {
    event: 'delta';
    runId: string;
    delta: string;
} | {
    event: 'thinking_delta';
    runId: string;
    delta: string;
} | {
    event: 'done';
    runId: string;
    text: string;
    reasoning: string;
} | {
    event: 'error';
    runId: string;
    message: string;
} | {
    event: 'aborted';
    runId: string;
};
/** One-shot completion response. */
export interface CompleteResponseWire {
    text: string;
    reasoning: string;
}
/** zustand persist envelope as stored server-side. */
export interface StoreBlobWire {
    state: Record<string, unknown>;
    version: number;
}
/** Session record wire shape (subset the pages persist). */
export interface SessionRecordWire {
    id: string;
    title: string;
    savedAt: number;
    sessionKind?: 'chat' | 'story' | 'bookTravel';
    characterCardId?: string | null;
    characterCardIds?: string[] | null;
    selectedWorldBookId?: string | null;
    dynamicRoleLoadingEnabled?: boolean;
    messages: {
        id: string;
        role: 'user' | 'agent';
        content: string;
        thinking?: string;
        thinkingBlocks?: {
            id: string;
            content: string;
            signature?: string;
        }[];
        tools?: {
            id?: string;
            name: string;
            result: string;
            status?: string;
            arguments?: string;
        }[];
        articleType?: string;
        suggestedChoices?: string[];
    }[];
    todos?: {
        content: string;
        status: string;
    }[];
    contextCompaction?: unknown;
    isArchived?: boolean;
    selectedStylePresetIds?: string[];
    initialStylePresetIds?: string[];
    initialSystemPromptSnapshot?: string | null;
    bookTravelState?: unknown;
}
/** Session summary wire shape of GET /sessions/<kind>. */
export interface SessionSummaryWire {
    id: string;
    title: string;
    savedAt: number;
    sessionKind?: 'chat' | 'story' | 'bookTravel';
    characterCardId?: string | null;
    characterCardIds?: string[] | null;
    selectedWorldBookId?: string | null;
    dynamicRoleLoadingEnabled?: boolean;
    messageCount: number;
}
/** GET /plugins/museai/models — the DSH model catalog + default selection. */
export declare function fetchModels(): Promise<ModelsResponseWire>;
/**
 * POST /plugins/museai/chat — streaming generation over NDJSON events.
 * @param request - the validated request body.
 * @param onEvent - called for every stream event.
 * @param signal - abort to stop generation (the server terminates the model
 * call and emits `aborted`).
 */
export declare function streamChat(request: ChatRequestWire, onEvent: (event: ChatStreamEventWire) => void, signal?: AbortSignal): Promise<void>;
/** POST /plugins/museai/complete — one-shot generation returning JSON. */
export declare function complete(request: ChatRequestWire): Promise<CompleteResponseWire>;
/** GET /plugins/museai/store/<key> — one store envelope. */
export declare function getStore(key: string): Promise<StoreBlobWire>;
/** PUT /plugins/museai/store/<key> — write one store envelope. */
export declare function putStore(key: string, blob: StoreBlobWire): Promise<void>;
/** GET /plugins/museai/sessions/<kind> — session summaries. */
export declare function listSessions(kind: 'partner' | 'story'): Promise<SessionSummaryWire[]>;
/** GET /plugins/museai/sessions/<kind>/<id> — one full session record. */
export declare function loadSession(kind: 'partner' | 'story', id: string): Promise<SessionRecordWire>;
/** PUT /plugins/museai/sessions/<kind>/<id> — save one session record. */
export declare function saveSession(kind: 'partner' | 'story', record: SessionRecordWire): Promise<void>;
/** DELETE /plugins/museai/sessions/<kind>/<id> — remove one session record. */
export declare function deleteSession(kind: 'partner' | 'story', id: string): Promise<boolean>;
/** Whether the server half is reachable (used for offline fallback decisions). */
export declare function pingModels(): Promise<boolean>;
