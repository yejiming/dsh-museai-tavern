/**
 * MuseAI host row for the dsh web GUI: provides the `museaiStore` service
 * (storage-domain-backed persistence for the MuseAI stores and agent
 * sessions) and the loader configuration with deployment defaults. No HTTP
 * routes live here — the sibling `museai-routes` row (`./routes`) mounts
 * `/plugins/museai/*` only where a webserver exists, so this row keeps
 * working in headless profiles.
 * @module @yejiming/dsh-museai-tavern
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createMuseaiStore, type MuseaiStore } from './domain.ts'

/** Cordis plugin name (diagnostics only). */
export const name = 'museai'

/** Services required before the store can serve. */
export const inject: string[] = []

/**
 * Deployment configuration. Deliberately credential-free: every model call
 * routes through the harness's own `llm` service, so no provider/baseUrl/api
 * key fields exist here or anywhere in this plugin.
 */
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

/**
 * Mount the museai host row: open the storage domain (or fall back to
 * memory) and expose the store service.
 * @param ctx - host cordis context.
 * @param config - validated loader configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  void config
  const store = await createMuseaiStore(ctx)
  ctx.provide('museaiStore', store)
  ctx.logger.info('museai: store ready (durable=%s)', store.durable)
}
