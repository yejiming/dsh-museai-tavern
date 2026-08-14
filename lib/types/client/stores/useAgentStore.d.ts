export interface AgentToolEntry {
    id?: string;
    name: string;
    result: string;
    status?: string;
    arguments?: string;
}
export interface ThinkingBlock {
    id: string;
    content: string;
    signature?: string;
}
export interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    thinking?: string;
    thinkingBlocks?: ThinkingBlock[];
    tools?: AgentToolEntry[];
    articleType?: string;
    suggestedChoices?: string[];
}
export interface AgentTodo {
    content: string;
    status: string;
}
export interface SessionContextCompaction {
    summary: string;
    compactedThroughMessageId?: string | null;
    compactedThroughIndex: number;
    sourceMessageCount: number;
    updatedAt: number;
}
export interface SkillDefinition {
    name: string;
    description: string;
    path: string;
}
export interface AgentSessionSummary {
    id: string;
    title: string;
    savedAt: number;
    sessionKind?: 'chat' | 'story' | 'bookTravel';
    characterCardId?: string | null;
    characterCardIds?: string[] | null;
    selectedWorldBookId?: string | null;
    dynamicRoleLoadingEnabled?: boolean;
}
export interface AgentSessionRecord extends AgentSessionSummary {
    messages: Message[];
    selectedReferenceFiles: string[];
    selectedOutlineFile?: string | null;
    todos: AgentTodo[];
    contextCompaction?: SessionContextCompaction | null;
    isArchived?: boolean;
    characterCardId?: string | null;
    characterCardIds?: string[] | null;
    selectedWorldBookId?: string | null;
    dynamicRoleLoadingEnabled?: boolean;
    selectedStylePresetIds?: string[];
    initialStylePresetIds?: string[];
    initialSystemPromptSnapshot?: string | null;
    bookTravelState?: unknown;
}
interface AgentStoreState {
    messages: Message[];
    input: string;
    isStreaming: boolean;
    expandedBlocks: Record<string, boolean>;
    selectedReferenceFiles: string[];
    selectedOutlineFile: string | null;
    todos: AgentTodo[];
    contextCompaction: SessionContextCompaction | null;
    isTodoOpen: boolean;
    sessions: AgentSessionSummary[];
    skills: SkillDefinition[];
    sessionId: string;
    sessionTitle: string;
    activeRun: {
        runId: string | null;
        messageId: string | null;
    };
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    setInput: (input: string) => void;
    setIsStreaming: (isStreaming: boolean) => void;
    setExpandedBlocks: (blocks: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    setSelectedReferenceFiles: (files: string[]) => void;
    setSelectedOutlineFile: (file: string | null) => void;
    setTodos: (todos: AgentTodo[]) => void;
    setContextCompaction: (contextCompaction: SessionContextCompaction | null) => void;
    setIsTodoOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
    setSessions: (sessions: AgentSessionSummary[]) => void;
    setSkills: (skills: SkillDefinition[]) => void;
    setSessionId: (id: string) => void;
    setSessionTitle: (title: string) => void;
    setActiveRun: (run: {
        runId: string | null;
        messageId: string | null;
    }) => void;
    createNewSession: () => void;
}
export declare const useAgentStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<AgentStoreState>, "setState" | "persist"> & {
    setState(partial: AgentStoreState | Partial<AgentStoreState> | ((state: AgentStoreState) => AgentStoreState | Partial<AgentStoreState>), replace?: false | undefined): unknown;
    setState(state: AgentStoreState | ((state: AgentStoreState) => AgentStoreState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<AgentStoreState, unknown, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: AgentStoreState) => void) => () => void;
        onFinishHydration: (fn: (state: AgentStoreState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<AgentStoreState, unknown, unknown>>;
    };
}>;
export {};
