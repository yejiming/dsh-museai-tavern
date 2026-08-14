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

function stableContentKey(prefix: string, content: string) {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0;
  }
  return `${prefix}-${content.length}-${hash >>> 0}`;
}

export function createStableContentKey(prefix: string) {
  const seen = new Map<string, number>();

  return (content: string) => {
    const baseKey = stableContentKey(prefix, content);
    const seenCount = seen.get(baseKey) ?? 0;
    seen.set(baseKey, seenCount + 1);
    return seenCount === 0 ? baseKey : `${baseKey}-${seenCount}`;
  };
}

export function createStableToolKey(prefix: string) {
  const getFallbackKey = createStableContentKey(prefix);

  return (tool: ToolIdentity) => {
    if (tool.id) {
      return `${prefix}-${tool.id}`;
    }
    return getFallbackKey(`${tool.name}\n${tool.arguments ?? ''}\n${tool.result ?? ''}`);
  };
}

export function createAgentTodoKeyGenerator(prefix: string) {
  const getFallbackKey = createStableContentKey(prefix);

  return (todo: TodoIdentity) => getFallbackKey(`${todo.status}\n${todo.content}`);
}
