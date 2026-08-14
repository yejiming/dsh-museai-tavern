import { Message, AgentSessionSummary, SessionContextCompaction } from './useAgentStore';
import { PartnerItemFields } from './usePartnerStore';
interface PartnerChatState {
    messages: Message[];
    input: string;
    isStreaming: boolean;
    expandedBlocks: Record<string, boolean>;
    selectedWorldBookId: string | null;
    selectedCharacterCardId: string | null;
    userInfo: Partial<PartnerItemFields>;
    sessions: AgentSessionSummary[];
    sessionId: string;
    sessionTitle: string;
    activeRun: {
        runId: string | null;
        messageId: string | null;
    };
    isSessionArchived: boolean;
    contextCompaction: SessionContextCompaction | null;
    selectedStylePresetIds: string[];
    initialStylePresetIds: string[];
    initialSystemPromptSnapshot: string | null;
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    setInput: (input: string) => void;
    setIsStreaming: (isStreaming: boolean) => void;
    setExpandedBlocks: (blocks: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    setSelectedWorldBookId: (id: string | null) => void;
    setSelectedCharacterCardId: (id: string | null) => void;
    setUserInfo: (info: Partial<PartnerItemFields> | ((prev: Partial<PartnerItemFields>) => Partial<PartnerItemFields>)) => void;
    setSessions: (sessions: AgentSessionSummary[]) => void;
    setSessionId: (id: string) => void;
    setSessionTitle: (title: string) => void;
    setActiveRun: (run: {
        runId: string | null;
        messageId: string | null;
    }) => void;
    setIsSessionArchived: (val: boolean) => void;
    setContextCompaction: (contextCompaction: SessionContextCompaction | null) => void;
    setSelectedStylePresetIds: (ids: string[]) => void;
    setInitialStylePresetSnapshot: (ids: string[], prompt: string) => void;
    createNewSession: () => void;
}
export declare const usePartnerChatStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<PartnerChatState>, "setState" | "persist"> & {
    setState(partial: PartnerChatState | Partial<PartnerChatState> | ((state: PartnerChatState) => PartnerChatState | Partial<PartnerChatState>), replace?: false | undefined): unknown;
    setState(state: PartnerChatState | ((state: PartnerChatState) => PartnerChatState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<PartnerChatState, unknown, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: PartnerChatState) => void) => () => void;
        onFinishHydration: (fn: (state: PartnerChatState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<PartnerChatState, unknown, unknown>>;
    };
}>;
export {};
