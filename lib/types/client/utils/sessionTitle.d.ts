import type { Message } from '../stores/useAgentStore';
interface ResolveSessionTitleOptions {
    currentTitle: string;
    defaultTitle: string;
    messages: Message[];
    finalFallback: string;
    summarize: () => Promise<string>;
}
export declare const hasMeaningfulSessionTitle: (title: string, defaultTitle: string) => boolean;
export declare const buildSessionTitleFallback: (messages: Message[], finalFallback: string) => string;
export declare const resolveSessionTitle: ({ currentTitle, defaultTitle, messages, finalFallback, summarize, }: ResolveSessionTitleOptions) => Promise<string>;
export {};
