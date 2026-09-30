/** Real DSH services and packaged entry points, without credentials or model calls. */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, LlmRuntime, type StreamChunk } from '@deepseek-ai/dsh-llm'
import * as Host from '../lib/index.js'
import * as Routes from '../lib/routes.js'

describe('DSH 0.2 packaged host compatibility', () => {
  it.each([['host', Host], ['routes', Routes]] as const)('%s configuration uses the loader Standard Schema contract', async (_name, plugin) => {
    const result = await plugin.Config['~standard'].validate({})
    expect(result).toEqual({ value: {
      chatTimeoutMs: 120000,
      completeTimeoutMs: 120000,
      modelsTimeoutMs: 10000,
      maxCompleteChars: 20000,
    } })
  })

  it('rejects the terminal failure produced by the real LLM service', async () => {
    class FailingAdapter extends LlmAdapter {
      async *stream(): AsyncIterable<StreamChunk> {
        yield { type: 'text-delta', index: 0, text: 'partial' }
        throw new Error('adapter connection failed')
      }
    }
    const ctx = new Context()
    const fiber = ctx.plugin(LlmRuntime)
    try {
      await ctx.inject(['llm'], async (scope) => {
        scope.llm.registerAdapter(['compat-test'], new FailingAdapter())
        await expect(Routes.assemble(scope.llm.stream({
          provider: 'compat-test', model: 'test', messages: [],
        }))).rejects.toThrow('adapter connection failed')
      })
    } finally {
      await fiber.dispose()
    }
  })

  it('mounts the packaged rows without a web server in a headless context', async () => {
    const ctx = new Context()
    const host = ctx.plugin(Host)
    const routes = ctx.plugin(Routes)
    try {
      await ctx.inject(['museaiStore'], async (scope) => {
        expect(scope.museaiStore.durable).toBe(false)
        await scope.museaiStore.putStore('settings', { state: { test: true }, version: 1 })
        expect(scope.museaiStore.getStore('settings')).toEqual({ state: { test: true }, version: 1 })
      })
    } finally {
      await routes.dispose()
      await host.dispose()
    }
  })
})
