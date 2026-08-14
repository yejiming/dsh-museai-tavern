/**
 * Ported MuseAI Chat page (伴侣对谈): streaming dialogue against a character
 * card / world book, with session save/load/rename/delete, memory archiving,
 * context usage ring, message editing/regeneration and style presets.
 *
 * All model traffic goes through the plugin's browser API (`src/client/api.ts`):
 * - streaming: `streamChat(request, onEvent, abortSignal)` (NDJSON events)
 * - session title: `complete(...)` → `.text`
 * - memory archiving: `complete(...)` → `.text` parsed by archiveAnalysis
 * - session CRUD: `listSessions` / `loadSession` / `saveSession` / `deleteSession`
 *   with kind 'partner'.
 * @module @yejiming/dsh-museai-tavern/client/pages/Chat
 */
import React from 'react';
export declare const ChatPage: React.FC;
