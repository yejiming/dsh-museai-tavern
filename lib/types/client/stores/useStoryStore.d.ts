import { Message, AgentSessionSummary, SessionContextCompaction } from './useAgentStore';
interface StoryState {
    messages: Message[];
    input: string;
    inputMode: 'speech' | 'behavior' | 'plot';
    isStreaming: boolean;
    expandedBlocks: Record<string, boolean>;
    selectedWorldBookId: string | null;
    selectedCharacterCardIds: string[];
    sessions: AgentSessionSummary[];
    sessionId: string;
    sessionTitle: string;
    activeRun: {
        runId: string | null;
        messageId: string | null;
    };
    isSessionArchived: boolean;
    initialPlot: string;
    contextCompaction: SessionContextCompaction | null;
    dynamicRoleLoadingEnabled: boolean;
    selectedStylePresetIds: string[];
    initialStylePresetIds: string[];
    initialSystemPromptSnapshot: string | null;
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    setInput: (input: string) => void;
    setInputMode: (mode: 'speech' | 'behavior' | 'plot') => void;
    setIsStreaming: (isStreaming: boolean) => void;
    setExpandedBlocks: (blocks: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    setSelectedWorldBookId: (id: string | null) => void;
    setSelectedCharacterCardIds: (ids: string[]) => void;
    setSessions: (sessions: AgentSessionSummary[]) => void;
    setSessionId: (id: string) => void;
    setSessionTitle: (title: string) => void;
    setActiveRun: (run: {
        runId: string | null;
        messageId: string | null;
    }) => void;
    setIsSessionArchived: (val: boolean) => void;
    setInitialPlot: (plot: string) => void;
    setContextCompaction: (contextCompaction: SessionContextCompaction | null) => void;
    setDynamicRoleLoadingEnabled: (enabled: boolean) => void;
    setSelectedStylePresetIds: (ids: string[]) => void;
    setInitialStylePresetSnapshot: (ids: string[], prompt: string) => void;
    createNewSession: () => void;
}
export declare const useStoryStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<StoryState>, "setState" | "persist"> & {
    setState(partial: StoryState | Partial<StoryState> | ((state: StoryState) => StoryState | Partial<StoryState>), replace?: false | undefined): unknown;
    setState(state: StoryState | ((state: StoryState) => StoryState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<StoryState, unknown, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: StoryState) => void) => () => void;
        onFinishHydration: (fn: (state: StoryState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<StoryState, unknown, unknown>>;
    };
}>;
export {};
