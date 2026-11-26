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
  /** Прикреплённые файлы и фото (текст файлов добавляется в запрос при отправке, content остаётся чистым) */
  attachments?: Attachment[];
  /** Действия пользователя в виджетах (телефон, кубики): из них вычисляется состояние виджетов */
  widgetOps?: WidgetOp[];
}

export type WidgetOp = { w: string; t: string; [k: string]: unknown };

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  kind: 'text' | 'image';
  size: number;
  /** Содержимое текстового файла */
  text?: string;
  /** Фото в base64 (уже уменьшенное) */
  data?: string;
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

  /** Системный промпт только этого чата (слой поверх общего и режима) */
  systemPrompt?: string;
  /** Выключить общий промпт из настроек / промпт режима для этого чата */
  noGlobalPrompt?: boolean;
  noModePrompt?: boolean;
  /** Свои параметры чата. Если не заданы, берутся из режима */
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Поиск Google (Gemini): true/false переопределяет настройку, пусто означает «как в режиме» */
  search?: boolean;
  /** Размер контекста модели в токенах (из списка моделей или введён вручную) */
  contextLimit?: number;
  /** Выжимка старой части переписки и id последнего сообщения, которое она заменяет */
  summary?: string;
  summaryUpToId?: string;
  /** Ролплей: персонаж и персона этого чата (персона пусто = по умолчанию) */
  characterId?: string;
  personaId?: string;
  /** Подключённые к чату лорбуки */
  lorebookIds?: string[];
  /** Не сжимать этот чат автоматически */
  noAutoSummary?: boolean;
  /** Включённые в этом чате виджеты и открыта ли их панель */
  widgets?: string[];
  widgetsOpen?: boolean;
}

export interface ModelInfo {
  id: string;
  /** Размер контекста в токенах, если провайдер его сообщил */
  context?: number;
}

export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
  createdAt: number;
}

export type ProviderKind =
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'openai'
  | 'xai'
  | 'cerebras'
  | 'together'
  | 'nvidia'
  | 'custom';

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
  /** Фото, base64 */
  images?: { mime: string; data: string }[];
}

export interface StreamParams {
  messages: ChatMessageInput[];
  system: string;
  temperature: number;
  topP: number;
  googleSearch: boolean;
  /** Максимум токенов в ответе (если не задан, решает провайдер) */
  maxTokens?: number;
  signal: AbortSignal;
  /** Провайдер сообщает точное число токенов, когда оно известно */
  onUsage?: (u: { completion?: number; prompt?: number }) => void;
}

/** Карточка персонажа (совместима с форматом Character Card V2 из SillyTavern/Chub). */
export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];
  exampleDialogue: string;
  /** Системный промпт самой карточки (если автор его задал) */
  systemPrompt: string;
  creatorNotes: string;
  tags: string[];
  /** Аватар: уменьшенный JPEG в виде data URL */
  avatar?: string;
  /** Встроенный лорбук карточки в исходном виде (будет использоваться в этапе 4B, при экспорте сохраняется) */
  book?: unknown;
  /** Лорбук, связанный с карточкой (подключается к чатам с этим персонажем) */
  lorebookId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Персона игрока: кем ты являешься в истории. */
export interface Persona {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

/** Запись лорбука: срабатывает, когда в недавней переписке встречается одно из ключевых слов. */
export interface LoreEntry {
  id: string;
  name: string;
  keys: string[];
  content: string;
  enabled: boolean;
  /** Всегда включена, независимо от ключей */
  constant: boolean;
  /** Чем больше число, тем раньше запись попадает в запрос (важнее) */
  order: number;
}

export interface Lorebook {
  id: string;
  name: string;
  entries: LoreEntry[];
  createdAt: number;
  updatedAt: number;
}
