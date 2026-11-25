import { getMode } from '../modes';
import type { Chat, ChatMessageInput, Message } from '../types';

/** Грубая обрезка контекста по символам: страховка, если выжимку никто не делал. */
const MAX_CONTEXT_CHARS = 48_000;

export interface BuiltContext {
  /** Итоговый системный промпт: слои склеены в порядке «общий → режим → чат → выжимка → пожелание» */
  system: string;
  layers: { global: string; mode: string; chat: string; summary: string; instruction: string };
  /** Сообщения, которые уйдут модели (без тех, что уже заменены выжимкой) */
  input: ChatMessageInput[];
  temperature: number;
  topP: number;
  maxTokens?: number;
  googleSearch: boolean;
  /** Сколько сообщений заменено выжимкой */
  summarizedCount: number;
}

/**
 * Единое место, где собирается запрос к модели. Его же использует панель настроек чата,
 * чтобы показать, что именно уходит модели.
 *
 * Порядок слоёв выбран так, чтобы начало запроса почти не менялось от сообщения к сообщению:
 * тогда провайдер может кэшировать его и отвечать быстрее и дешевле.
 */
export function buildContext(args: {
  chat: Chat;
  messages: Record<string, Message>;
  /** Путь до сообщения, на которое отвечаем (включительно) */
  path: string[];
  globalPrompt: string;
  searchEnabled: boolean;
  /** Разовое пожелание к ответу, в историю не попадает */
  instruction?: string;
  /** Дополнительные сообщения в конце (например, просьба продолжить) */
  tail?: ChatMessageInput[];
}): BuiltContext {
  const { chat, messages, path, tail } = args;
  const mode = getMode(chat.modeId ?? 'general');

  let history = path.map((id) => messages[id]).filter(Boolean);
  let summary = '';
  let summarizedCount = 0;
  if (chat.summary?.trim() && chat.summaryUpToId) {
    const i = history.findIndex((m) => m.id === chat.summaryUpToId);
    if (i >= 0) {
      history = history.slice(i + 1);
      summary = chat.summary.trim();
      summarizedCount = i + 1;
    }
  }

  const input: ChatMessageInput[] = history
    .filter((m) => m.role !== 'system' && m.content)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  if (tail) input.push(...tail);

  let total = input.reduce((n, m) => n + m.content.length, 0);
  while (input.length > 2 && total > MAX_CONTEXT_CHARS) total -= input.shift()!.content.length;

  const layers = {
    global: chat.noGlobalPrompt ? '' : args.globalPrompt.trim(),
    mode: chat.noModePrompt ? '' : mode.systemPrompt,
    chat: (chat.systemPrompt ?? '').trim(),
    summary: summary
      ? `Краткое содержание более ранней части этой переписки (самих сообщений ты уже не видишь):\n${summary}`
      : '',
    instruction: args.instruction?.trim() ? `[Пожелание пользователя к этому ответу: ${args.instruction.trim()}]` : '',
  };

  return {
    system: Object.values(layers).filter(Boolean).join('\n\n'),
    layers,
    input,
    temperature: chat.temperature ?? mode.temperature,
    topP: chat.topP ?? mode.topP,
    maxTokens: chat.maxTokens,
    googleSearch: chat.search ?? (mode.googleSearch && args.searchEnabled),
    summarizedCount,
  };
}
