/**
 * MuseAI browser half, plugin entry: registers the MuseAI conversation-view
 * tab (right of Trajectory, order 15) and the `museai` dictionaries. The view
 * renders the ported MuseAI pages (背景/聊天/冒险/羁绊/设置); all state lives
 * behind the plugin's own routes (`/plugins/museai/*`), so tab switches and
 * session switches never lose data — the view only mirrors what the store
 * reports.
 * @module @yejiming/dsh-museai-tavern/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation view-slot declaration (conversation.view)
// into this program.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MuseAIView } from './MuseAIView.tsx'
import { NS, en, zh, type MuseAIKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The MuseAI tab copy. */
    'museai': MuseAIKey
  }
}

/** Required services: the locale service and the slot registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the museai dictionaries and the MuseAI
 * conversation-view tab. The registration rides the slot service's effect
 * wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'museai: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    // order 15 places the tab right of Trajectory (order 10) and left of
    // gomoku (order 20), matching the old data-agent database tab.
    id: 'museai',
    order: 15,
    label: () => t('tab.label'),
    locale: NS,
  }, MuseAIView))
}
