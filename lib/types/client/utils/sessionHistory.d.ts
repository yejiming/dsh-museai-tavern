import type { AgentSessionSummary } from '../stores/useAgentStore';
import type { PartnerItem } from '../stores/usePartnerStore';
export interface ResolvedSessionHistoryMeta {
    worldBookId: string | null;
    worldBookName: string | null;
    characterCards: Array<{
        id: string;
        name: string;
    }>;
}
export declare function formatHistorySavedAt(savedAt?: number | null): string;
export declare function resolveSessionHistoryMeta(session: AgentSessionSummary, worldBooks: PartnerItem[], characterCards: PartnerItem[]): ResolvedSessionHistoryMeta;
export declare function sessionMatchesHistoryFilters(session: AgentSessionSummary, worldBooks: PartnerItem[], characterCards: PartnerItem[], filters: {
    worldBookId?: string | null;
    characterCardId?: string | null;
}): boolean;
export declare function buildSessionHistoryDetails(session: AgentSessionSummary, worldBooks: PartnerItem[], characterCards: PartnerItem[]): {
    description: string;
    details: string[];
};
