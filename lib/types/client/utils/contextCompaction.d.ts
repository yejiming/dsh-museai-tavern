import { Message, SessionContextCompaction } from '../stores/useAgentStore';
export declare const getEffectiveMessagesForContextStats: (messages: Message[], contextCompaction: SessionContextCompaction | null) => Message[];
