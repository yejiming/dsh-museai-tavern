interface ToolIdentity {
    id?: string;
    name: string;
    result?: string;
    arguments?: string;
}
interface TodoIdentity {
    content: string;
    status: string;
}
export declare function createStableContentKey(prefix: string): (content: string) => string;
export declare function createStableToolKey(prefix: string): (tool: ToolIdentity) => string;
export declare function createAgentTodoKeyGenerator(prefix: string): (todo: TodoIdentity) => string;
export {};
