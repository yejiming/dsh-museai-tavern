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
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import z from 'schemastery';
import { z as zod } from 'zod';
/** Cordis plugin name (diagnostics only). */
export declare const name = "museai-routes";
/**
 * No top-level `inject` export: the row must ACTIVATE even in headless
 * profiles where `webServer` never exists. The routes register through a
 * nested inject fiber the moment the webserver and the store are both
 * available.
 */
export declare const inject: string[];
/** Route prefix owned by this plugin (the browser half calls under it). */
export declare const MUSAI_PATH = "/plugins/museai";
/** Routes-half configuration (defaults mirror the main row). */
export interface Config {
    /** Deadline for one streaming chat request, milliseconds. */
    chatTimeoutMs: number;
    /** Deadline for one non-streaming completion request, milliseconds. */
    completeTimeoutMs: number;
    /** Deadline for the model-catalog interrogation, milliseconds. */
    modelsTimeoutMs: number;
    /** In-memory cap on captured non-streaming output, characters. */
    maxCompleteChars: number;
}
/** Loader schema with deployment defaults (no library defaults). */
export declare const Config: z<Schemastery.ObjectS<{
    chatTimeoutMs: z<number, number>;
    completeTimeoutMs: z<number, number>;
    modelsTimeoutMs: z<number, number>;
    maxCompleteChars: z<number, number>;
}>, Schemastery.ObjectT<{
    chatTimeoutMs: z<number, number>;
    completeTimeoutMs: z<number, number>;
    modelsTimeoutMs: z<number, number>;
    maxCompleteChars: z<number, number>;
}>>;
/** One wire message of a chat/completion request. */
export interface WireMessage {
    role: 'user' | 'assistant';
    content: string;
}
/** Shared model-target part of a generation request. */
export interface ModelTarget {
    /** Use the DSH default model selection (provider/model resolved server-side). */
    followDefault?: boolean;
    provider?: string;
    model?: string;
}
/** Streaming chat request body. */
export interface ChatRequestBody extends ModelTarget {
    system?: string;
    messages: WireMessage[];
    temperature?: number;
    maxTokens?: number;
    thinkingDepth?: 'off' | 'low' | 'medium' | 'high';
}
/** One-shot completion request body. */
export interface CompleteRequestBody extends ModelTarget {
    system?: string;
    messages: WireMessage[];
    temperature?: number;
    maxTokens?: number;
    thinkingDepth?: 'off' | 'low' | 'medium' | 'high';
}
/** NDJSON stream events emitted by /chat. */
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
    usage?: unknown;
} | {
    event: 'error';
    runId: string;
    message: string;
} | {
    event: 'aborted';
    runId: string;
};
export declare const chatBodySchema: zod.ZodObject<{
    followDefault: zod.ZodOptional<zod.ZodBoolean>;
    provider: zod.ZodOptional<zod.ZodString>;
    model: zod.ZodOptional<zod.ZodString>;
    system: zod.ZodOptional<zod.ZodString>;
    messages: zod.ZodArray<zod.ZodObject<{
        role: zod.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: zod.ZodString;
    }, zod.core.$strip>>;
    temperature: zod.ZodOptional<zod.ZodNumber>;
    maxTokens: zod.ZodOptional<zod.ZodNumber>;
    thinkingDepth: zod.ZodOptional<zod.ZodEnum<{
        off: "off";
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
}, zod.core.$strip>;
export declare const completeBodySchema: zod.ZodObject<{
    followDefault: zod.ZodOptional<zod.ZodBoolean>;
    provider: zod.ZodOptional<zod.ZodString>;
    model: zod.ZodOptional<zod.ZodString>;
    system: zod.ZodOptional<zod.ZodString>;
    messages: zod.ZodArray<zod.ZodObject<{
        role: zod.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: zod.ZodString;
    }, zod.core.$strip>>;
    temperature: zod.ZodOptional<zod.ZodNumber>;
    maxTokens: zod.ZodOptional<zod.ZodNumber>;
    thinkingDepth: zod.ZodOptional<zod.ZodEnum<{
        off: "off";
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
}, zod.core.$strip>;
/**
 * Resolve the effective provider/model for a request: the DSH default
 * selection when `followDefault` is set (or neither provider nor model was
 * given), else the explicit ids.
 * @param ctx - host context with the llm and default-model services.
 * @param target - validated request model target.
 * @returns the provider and model, or null when unresolvable.
 */
export declare function resolveModelTarget(ctx: Context, target: ModelTarget): {
    provider: string;
    model: string;
} | null;
/** Assemble stream chunks into one text/reasoning result. */
export declare function assemble(chunks: AsyncIterable<StreamChunk>): Promise<{
    text: string;
    reasoning: string;
    truncated: boolean;
    usage?: unknown;
}>;
/** Assemble GenerateOptions from a validated body (shared by chat/complete). */
export declare function buildGenerateOptions(ctx: Context, body: ChatRequestBody | CompleteRequestBody, signal: AbortSignal): Promise<GenerateOptions | null>;
/** GET /plugins/museai/models — the DSH model catalog + default selection. */
export declare function handleModels(ctx: Context, res: ServerResponse, timeoutMs: number): Promise<void>;
/** POST /plugins/museai/chat — streaming generation, NDJSON events. */
export declare function handleChat(ctx: Context, req: IncomingMessage, res: ServerResponse, timeoutMs: number): Promise<void>;
/** POST /plugins/museai/complete — one-shot generation, JSON response. */
export declare function handleComplete(ctx: Context, req: IncomingMessage, res: ServerResponse, timeoutMs: number): Promise<void>;
/** GET/PUT /plugins/museai/store/<key> */
export declare function handleStore(ctx: Context, req: IncomingMessage, res: ServerResponse, key: string): Promise<void>;
/** GET /plugins/museai/sessions/<kind> */
export declare function handleSessionList(ctx: Context, res: ServerResponse, kind: string): Promise<void>;
/** GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id> */
export declare function handleSession(ctx: Context, req: IncomingMessage, res: ServerResponse, kind: string, id: string): Promise<void>;
/**
 * Mount the museai routes the moment the webserver and the store service are
 * both available; headless profiles simply never reach this fiber.
 * @param ctx - host cordis context.
 * @param config - validated loader configuration.
 */
export declare function apply(ctx: Context, config: Config): void;
