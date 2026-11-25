export type Role = 'user' | 'assistant' | 'system';

/** Сколько ждали ответ и сколько в нём токенов. */
export interface MessageStats {
  /** Время до первого символа, мс */
  ttftMs: number;
  /** Время всего ответа, мс */
  totalMs: number;
  /** Токенов в ответе */
  tokens: number;
  /** true, если число оценено приблизительно (провайдер не прислал точное) */
  approx: boolean;
  /** Токенов в запросе = размер контекста на момент ответа (если провайдер прислал) */
  promptTokens?: number;
}

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
  stats?: MessageStats;
}

export interface Chat {
  id: string;
  title: string;
  /** Последнее сообщение активной ветки */
  leafId: string | null;
  createdAt: number;
  updatedAt: number;
  /** Режим этого чата (общение / ролплей / код) */
  modeId?: string;
  /** Провайдер и модель только для этого чата. Если не заданы, берутся настройки по умолчанию */
  providerId?: ProviderKind;
  model?: string;
  /** Папка в левом меню */
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
  createdAt: number;
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
  /** Короткое пояснение для карточки выбора режима */
  description: string;
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
  /** Провайдер сообщает точное число токенов, когда оно известно */
  onUsage?: (u: { completion?: number; prompt?: number }) => void;
}
