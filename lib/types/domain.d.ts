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
import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
/** One persisted zustand store envelope. */
export interface StoreBlob {
    state: Record<string, unknown>;
    version: number;
}
/** Whitelisted store keys (mirrors MuseAI diskStorage config names). */
export declare const STORE_KEYS: readonly ["settings", "partners", "partnerChat", "story", "stylePresets", "agent"];
export type StoreKey = (typeof STORE_KEYS)[number];
/** Session kinds, mirroring MuseAI session prefixes. */
export declare const SESSION_KINDS: readonly ["partner", "story"];
export type SessionKind = (typeof SESSION_KINDS)[number];
/** One persisted conversation message (MuseAI `Message` wire shape). */
export interface SessionMessage {
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
}
/** One persisted agent session record (MuseAI `AgentSessionRecord` shape). */
export interface SessionRecord {
    id: string;
    title: string;
    savedAt: number;
    sessionKind?: 'chat' | 'story' | 'bookTravel';
    characterCardId?: string | null;
    characterCardIds?: string[] | null;
    selectedWorldBookId?: string | null;
    dynamicRoleLoadingEnabled?: boolean;
    messages: SessionMessage[];
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
/** Durable session record schema (validated at the storage boundary). */
export declare const sessionRecordSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    savedAt: z.ZodNumber;
    sessionKind: z.ZodOptional<z.ZodEnum<{
        story: "story";
        chat: "chat";
        bookTravel: "bookTravel";
    }>>;
    characterCardId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    characterCardIds: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    selectedWorldBookId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dynamicRoleLoadingEnabled: z.ZodOptional<z.ZodBoolean>;
    messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            agent: "agent";
            user: "user";
        }>;
        content: z.ZodString;
        thinking: z.ZodOptional<z.ZodString>;
        thinkingBlocks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
            signature: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            result: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
            arguments: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        articleType: z.ZodOptional<z.ZodString>;
        suggestedChoices: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    todos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>>>;
    contextCompaction: z.ZodOptional<z.ZodUnknown>;
    isArchived: z.ZodOptional<z.ZodBoolean>;
    selectedStylePresetIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    initialStylePresetIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    initialSystemPromptSnapshot: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bookTravelState: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
/** Durable store-envelope schema. */
export declare const storeBlobSchema: z.ZodObject<{
    state: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    version: z.ZodNumber;
}, z.core.$strip>;
/** The `museai` domain declaration. */
export declare const museaiDomainSpec: {
    name: string;
    version: number;
    tables: {
        store: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<"settings" | "partners" | "partnerChat" | "story" | "stylePresets" | "agent", StoreBlob>;
        sessions: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, SessionRecord>;
    };
};
/** Session table key: `"<kind>:<id>"`. */
export declare function sessionKey(kind: SessionKind, id: string): string;
/** Split a session table key back into kind and id; null when malformed. */
export declare function parseSessionKey(key: string): {
    kind: SessionKind;
    id: string;
} | null;
/**
 * The `museaiStore` service face: synchronous reads from authoritative
 * memory, asynchronous durable writes. Route handlers and the browser half
 * never touch the domain or the memory maps directly.
 */
export interface MuseaiStore {
    /** Domain-backed when the storage domain opened, memory-backed otherwise. */
    readonly durable: boolean;
    getStore(key: StoreKey): StoreBlob | undefined;
    putStore(key: StoreKey, value: StoreBlob): Promise<void>;
    listSessions(kind: SessionKind): SessionRecord[];
    getSession(kind: SessionKind, id: string): SessionRecord | undefined;
    putSession(kind: SessionKind, record: SessionRecord): Promise<void>;
    deleteSession(kind: SessionKind, id: string): Promise<boolean>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** MuseAI store service (domain-backed or memory fallback). */
        museaiStore: MuseaiStore;
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
export declare function createMuseaiStore(ctx: Context): MuseaiStore;
