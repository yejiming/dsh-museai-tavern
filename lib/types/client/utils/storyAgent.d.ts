import type { Message, ThinkingBlock } from '../stores/useAgentStore';
export interface StoryCharacterPromptSource {
    name: string;
    content: string;
}
export interface StoryPromptOptions {
    basePrompt: string;
    worldBookContent: string | null;
    characterCards: StoryCharacterPromptSource[];
    userInfo: Record<string, unknown>;
    dynamicRoleLoadingEnabled: boolean;
}
export interface StoryModelMessage {
    id?: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: string;
    }>;
    thinkingBlocks?: ThinkingBlock[];
}
export declare function compileStorySystemPrompt({ basePrompt, worldBookContent, characterCards, userInfo, dynamicRoleLoadingEnabled, }: StoryPromptOptions): string;
export declare function buildStoryModelMessages(messages: Message[]): StoryModelMessage[];
export declare function getStoryAllowedTools(dynamicRoleLoadingEnabled: boolean): string[];
export declare function getRolePlayCharacterName(argumentsText?: string): string;
