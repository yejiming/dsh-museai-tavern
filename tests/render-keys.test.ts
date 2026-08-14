import { describe, expect, it } from 'vitest';
import { createAgentTodoKeyGenerator } from '../src/client/utils/renderKeys';

describe('Agent Todo 渲染 key', () => {
  it('为重复内容保留独立且可复现的本地渲染身份', () => {
    const todos = [
      { content: '检查大纲', status: 'pending' },
      { content: '检查大纲', status: 'pending' },
      { content: '检查大纲', status: 'completed' },
    ];

    const firstGenerator = createAgentTodoKeyGenerator('agent-chat-todo');
    const firstKeys = todos.map(firstGenerator);
    const secondGenerator = createAgentTodoKeyGenerator('agent-chat-todo');
    const secondKeys = todos.map(secondGenerator);

    expect(new Set(firstKeys).size).toBe(todos.length);
    expect(secondKeys).toEqual(firstKeys);
    expect(firstKeys[0]).not.toBe(firstKeys[2]);
    expect(todos).toEqual([
      { content: '检查大纲', status: 'pending' },
      { content: '检查大纲', status: 'pending' },
      { content: '检查大纲', status: 'completed' },
    ]);
  });
});
