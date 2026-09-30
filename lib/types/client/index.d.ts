/**
 * MuseAI browser half, plugin entry: registers the MuseAI conversation-view
 * tab (right of Trajectory, order 15) and the `museai` dictionaries. The view
 * renders the ported MuseAI pages (背景/聊天/冒险/羁绊/设置); all state lives
 * behind the plugin's own routes (`/plugins/museai/*`), so tab switches and
 * session switches never lose data — the view only mirrors what the store
 * reports.
 * @module @yejiming/dsh-museai-tavern/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type MuseAIKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The MuseAI tab copy. */
        'museai': MuseAIKey;
    }
}
/** Required services: the locale service and the slot registry. */
export declare const inject: string[];
/**
 * Client plugin body: register the museai dictionaries and the MuseAI
 * conversation-view tab. The registration rides the slot service's effect
 * wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
