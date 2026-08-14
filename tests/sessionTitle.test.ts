import { describe, expect, it } from 'vitest';
import {
  buildSessionTitleFallback,
  hasMeaningfulSessionTitle,
  resolveSessionTitle,
} from '../src/client/utils/sessionTitle';

describe('session title helpers', () => {
  it('treats default placeholders as missing titles', () => {
    expect(hasMeaningfulSessionTitle('新聊天', '新聊天')).toBe(false);
    expect(hasMeaningfulSessionTitle(' 新故事 ', '新故事')).toBe(false);
    expect(hasMeaningfulSessionTitle('雾城夜谈', '新聊天')).toBe(true);
  });

  it('uses the first non-empty user message and truncates long titles', () => {
    expect(buildSessionTitleFallback([
      { id: 'a1', role: 'agent', content: '旁白', tools: [] },
      { id: 'u1', role: 'user', content: '   ', tools: [] },
      { id: 'u2', role: 'user', content: '这是一个超过十五个字符的用户消息标题内容', tools: [] },
    ], '未命名会话')).toBe('这是一个超过十五个字符的用户消...');
  });

  it('uses the final fallback when no user message has content', () => {
    expect(buildSessionTitleFallback([
      { id: 'a1', role: 'agent', content: '旁白', tools: [] },
    ], '未命名故事')).toBe('未命名故事');
  });

  it('skips summarization for an existing title', async () => {
    let summarizeCalled = false;
    const title = await resolveSessionTitle({
      currentTitle: '雾城夜谈',
      defaultTitle: '新聊天',
      messages: [],
      finalFallback: '未命名会话',
      summarize: async () => {
        summarizeCalled = true;
        return '新标题';
      },
    });

    expect(title).toBe('雾城夜谈');
    expect(summarizeCalled).toBe(false);
  });

  it('uses the first user message when summarization returns blank', async () => {
    const title = await resolveSessionTitle({
      currentTitle: '新聊天',
      defaultTitle: '新聊天',
      messages: [{ id: 'u1', role: 'user', content: '继续调查雾城', tools: [] }],
      finalFallback: '未命名会话',
      summarize: async () => '   ',
    });

    expect(title).toBe('继续调查雾城');
  });
});
