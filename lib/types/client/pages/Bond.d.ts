/**
 * Bond page (羁绊页) ported from MuseAI `src/pages/Bond.tsx`.
 *
 * Left: character-card directory tree grouped by world book; right: the
 * selected character's identity header, relation overview, bond timeline
 * (keyEvents), partner-chat session history (filtered by characterCardId) and
 * story adventure history (filtered by characterCardIds). The selection is
 * kept in two-way sync with `usePartnerChatStore.selectedCharacterCardId`.
 *
 * Session I/O goes through the DSH plugin api (`listSessions`/`loadSession`)
 * instead of the Tauri `invoke('list_agent_sessions'/'load_agent_session')`
 * calls of the original; the wire types (SessionSummaryWire/SessionRecordWire)
 * are consumed directly.
 * @module @yejiming/dsh-museai-tavern/client/pages/Bond
 */
import React from 'react';
export declare const BondPage: React.FC;
