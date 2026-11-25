export type Role = 'user' | 'assistant' | 'system';

/**
 * Сообщения хранятся как ДЕРЕВО (parentId), а не плоский список.
 * - Свайпы  = несколько assistant-сообщений с одним parentId.
 * - Ветки   = несколько ответов/продолжений от одного сообщения.
 * - Текущая переписка = путь от корня до chat.leafId.
 */
export interface Message {
  id: string;
  chatId: string;
  parentId: string | null;
  role: Role;
  content: string;
  createdAt: number;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  /** Последнее сообщение активной ветки */
  leafId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ProviderKind = 'gemini' | 'openrouter' | 'groq' | 'custom';

export interface ProviderConfig {
  id: ProviderKind;
  name: string;
  apiKey: string;
  model: string;
  /** Нужен для custom; для остальных есть значение по умолчанию */
  baseUrl?: string;
}

export interface Mode {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  /** Google Search Grounding (работает только с Gemini) */
  googleSearch: boolean;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamParams {
  messages: ChatMessageInput[];
  system: string;
  temperature: number;
  topP: number;
  googleSearch: boolean;
  signal: AbortSignal;
}
