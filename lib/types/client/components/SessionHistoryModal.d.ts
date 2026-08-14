import type { AgentSessionSummary } from '../stores/useAgentStore';
import type { PartnerItem } from '../stores/usePartnerStore';
import React from 'react';
interface SessionHistoryModalProps {
    open: boolean;
    title: string;
    emptyText: string;
    sessions: AgentSessionSummary[];
    worldBooks: PartnerItem[];
    characterCards: PartnerItem[];
    onClose: () => void;
    onOpenSession: (id: string) => void | Promise<void>;
    onDeleteSession: (id: string) => void | Promise<void>;
    onRenameSession: (id: string, title: string) => void | Promise<void>;
}
export declare function SessionHistoryModal({ open, title, emptyText, sessions, worldBooks, characterCards, onClose, onOpenSession, onDeleteSession, onRenameSession, }: SessionHistoryModalProps): React.JSX.Element;
export {};
