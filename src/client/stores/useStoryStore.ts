import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSyncStorage } from '../syncStorage';
import { Message, AgentSessionSummary, SessionContextCompaction } from './useAgentStore';
import { createSessionId } from '../utils/sessionIds';

interface StoryState {
  messages: Message[];
  input: string;
  inputMode: 'speech' | 'behavior' | 'plot';
  isStreaming: boolean;
  expandedBlocks: Record<string, boolean>;
  selectedWorldBookId: string | null;
  selectedCharacterCardIds: string[]; // Multi-select support!
  sessions: AgentSessionSummary[];
  sessionId: string;
  sessionTitle: string;
  activeRun: { runId: string | null; messageId: string | null };
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
  setActiveRun: (run: { runId: string | null; messageId: string | null }) => void;
  setIsSessionArchived: (val: boolean) => void;
  setInitialPlot: (plot: string) => void;
  setContextCompaction: (contextCompaction: SessionContextCompaction | null) => void;
  setDynamicRoleLoadingEnabled: (enabled: boolean) => void;
  setSelectedStylePresetIds: (ids: string[]) => void;
  setInitialStylePresetSnapshot: (ids: string[], prompt: string) => void;
  createNewSession: () => void;
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set) => ({
      messages: [],
      input: '',
      inputMode: 'speech',
      isStreaming: false,
      expandedBlocks: {},
      selectedWorldBookId: null,
      selectedCharacterCardIds: [],
      sessions: [],
      sessionId: createSessionId('story-session'),
      sessionTitle: '新故事',
      activeRun: { runId: null, messageId: null },
      isSessionArchived: false,
      initialPlot: '',
      contextCompaction: null,
      dynamicRoleLoadingEnabled: false,
      selectedStylePresetIds: [],
      initialStylePresetIds: [],
      initialSystemPromptSnapshot: null,

      setMessages: (updater) => set((state) => ({
        messages: typeof updater === 'function' ? updater(state.messages) : updater,
      })),
      setInput: (input) => set({ input }),
      setInputMode: (inputMode) => set({ inputMode }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setExpandedBlocks: (updater) => set((state) => ({
        expandedBlocks: typeof updater === 'function' ? updater(state.expandedBlocks) : updater,
      })),
      setSelectedWorldBookId: (selectedWorldBookId) => set({ selectedWorldBookId }),
      setSelectedCharacterCardIds: (selectedCharacterCardIds) => set({ selectedCharacterCardIds }),
      setSessions: (sessions) => set({ sessions }),
      setSessionId: (sessionId) => set({ sessionId }),
      setSessionTitle: (sessionTitle) => set({ sessionTitle }),
      setActiveRun: (activeRun) => set({ activeRun }),
      setIsSessionArchived: (isSessionArchived) => set({ isSessionArchived }),
      setInitialPlot: (initialPlot) => set({ initialPlot }),
      setContextCompaction: (contextCompaction) => set({ contextCompaction }),
      setDynamicRoleLoadingEnabled: (dynamicRoleLoadingEnabled) => set({ dynamicRoleLoadingEnabled }),
      setSelectedStylePresetIds: (selectedStylePresetIds) => set({ selectedStylePresetIds: selectedStylePresetIds.slice(-1) }),
      setInitialStylePresetSnapshot: (initialStylePresetIds, initialSystemPromptSnapshot) => set({ initialStylePresetIds, initialSystemPromptSnapshot }),

      createNewSession: () => {
        set(() => ({
          activeRun: { runId: null, messageId: null },
          messages: [],
          input: '',
          inputMode: 'speech',
          isStreaming: false,
          expandedBlocks: {},
          sessionId: createSessionId('story-session'),
          sessionTitle: '新故事',
          isSessionArchived: false,
          initialPlot: '',
          contextCompaction: null,
          dynamicRoleLoadingEnabled: false,
          selectedStylePresetIds: [],
          initialStylePresetIds: [],
          initialSystemPromptSnapshot: null,
        }));
      },
    }),
    {
      name: 'museai-story-storage',
      storage: createJSONStorage(() => createSyncStorage('story', 'museai-story-storage')),
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<StoryState> | undefined;
        return {
          ...currentState,
          selectedWorldBookId: state?.selectedWorldBookId ?? currentState.selectedWorldBookId,
          selectedCharacterCardIds: state?.selectedCharacterCardIds ?? currentState.selectedCharacterCardIds,
          initialPlot: state?.initialPlot ?? currentState.initialPlot,
          dynamicRoleLoadingEnabled: state?.dynamicRoleLoadingEnabled ?? currentState.dynamicRoleLoadingEnabled,
          selectedStylePresetIds: Array.isArray(state?.selectedStylePresetIds) ? state.selectedStylePresetIds.slice(-1) : [],
          initialStylePresetIds: Array.isArray(state?.initialStylePresetIds) ? state.initialStylePresetIds : [],
          initialSystemPromptSnapshot: typeof state?.initialSystemPromptSnapshot === 'string' ? state.initialSystemPromptSnapshot : null,
        };
      },
      partialize: (state) => ({
        selectedWorldBookId: state.selectedWorldBookId,
        selectedCharacterCardIds: state.selectedCharacterCardIds,
        initialPlot: state.initialPlot,
        dynamicRoleLoadingEnabled: state.dynamicRoleLoadingEnabled,
        selectedStylePresetIds: state.selectedStylePresetIds,
        initialStylePresetIds: state.initialStylePresetIds,
        initialSystemPromptSnapshot: state.initialSystemPromptSnapshot,
      }),
    }
  )
);
