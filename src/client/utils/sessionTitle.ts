import type { Message } from '../stores/useAgentStore';

interface ResolveSessionTitleOptions {
  currentTitle: string;
  defaultTitle: string;
  messages: Message[];
  finalFallback: string;
  summarize: () => Promise<string>;
}

export const hasMeaningfulSessionTitle = (title: string, defaultTitle: string) => {
  const trimmed = title.trim();
  return trimmed !== '' && trimmed !== defaultTitle;
};

export const buildSessionTitleFallback = (messages: Message[], finalFallback: string) => {
  const firstUserMessage = messages.find(
    (item) => item.role === 'user' && item.content.trim() !== '',
  )?.content.trim();

  if (!firstUserMessage) return finalFallback;
  const characters = Array.from(firstUserMessage);
  return characters.length > 15
    ? `${characters.slice(0, 15).join('')}...`
    : firstUserMessage;
};

export const resolveSessionTitle = async ({
  currentTitle,
  defaultTitle,
  messages,
  finalFallback,
  summarize,
}: ResolveSessionTitleOptions) => {
  if (hasMeaningfulSessionTitle(currentTitle, defaultTitle)) {
    return currentTitle.trim();
  }

  try {
    const generatedTitle = (await summarize()).trim();
    if (generatedTitle) return generatedTitle;
  } catch (error) {
    console.warn('生成会话标题失败，使用本地标题:', error);
  }

  return buildSessionTitleFallback(messages, finalFallback);
};
