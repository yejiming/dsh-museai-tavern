/**
 * MuseAI host row for the dsh web GUI: provides the `museaiStore` service
 * (storage-domain-backed persistence for the MuseAI stores and agent
 * sessions) and the loader configuration with deployment defaults. No HTTP
 * routes live here — the sibling `museai-routes` row (`./routes`) mounts
 * `/plugins/museai/*` only where a webserver exists, so this row keeps
 * working in headless profiles.
 * @module @yejiming/dsh-museai-tavern
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Cordis plugin name (diagnostics only). */
export declare const name = "museai";
/** Services required before the store can serve. */
export declare const inject: string[];
/**
 * Deployment configuration. Deliberately credential-free: every model call
 * routes through the harness's own `llm` service, so no provider/baseUrl/api
 * key fields exist here or anywhere in this plugin.
 */
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
/**
 * Mount the museai host row: open the storage domain (or fall back to
 * memory) and expose the store service.
 * @param ctx - host cordis context.
 * @param config - validated loader configuration.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;
