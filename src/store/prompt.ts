import { getMode } from '../modes';
import { activeEntries } from '../lib/lorebook';
import { foldWidgets, widgetPrompt } from '../widgets/registry';
import { useSettings } from './settings';
import { useRp } from './rp';
import type { Character, Chat, ChatMessageInput, Message } from '../types';

/** Текст сообщения для модели: сам текст и содержимое прикреплённых текстовых файлов. */
export function messageText(m: Message): string {
  const files = (m.attachments ?? [])
    .filter((a) => a.kind === 'text')
    .map((a) => `[Файл: ${a.name}]\n\`\`\`\n${a.text ?? ''}\n\`\`\``);
  return [m.content, ...files].filter(Boolean).join('\n\n');
}

/** Персонаж и персона этого чата (персона чата, иначе по умолчанию из настроек). */
export function resolveRp(chat: Chat) {
  const { characters, personas } = useRp.getState();
  const character = chat.characterId ? characters.find((c) => c.id === chat.characterId) : undefined;
  const pid = chat.personaId ?? useSettings.getState().defaultPersonaId;
  const persona = pid ? personas.find((p) => p.id === pid) : undefined;
  return { character, persona };
}

/** Подставляет имена вместо {{char}} и {{user}} (так принято в карточках SillyTavern). */
export function fillNames(text: string, charName = 'Персонаж', userName = 'Игрок'): string {
  return text.replace(/\{\{\s*char\s*\}\}/gi, charName).replace(/\{\{\s*user\s*\}\}/gi, userName);
}

function characterPrompt(c: Character): string {
  const parts = [
    `[Персонаж, за которого ты играешь: ${c.name}]`,
    c.systemPrompt.trim(),
    c.description.trim(),
    c.personality.trim() && `Характер: ${c.personality.trim()}`,
    c.scenario.trim() && `Сценарий: ${c.scenario.trim()}`,
    c.exampleDialogue.trim() && `Пример манеры речи и диалога:\n${c.exampleDialogue.trim()}`,
  ];
  return parts.filter(Boolean).join('\n');
}

/** Грубая обрезка контекста по символам: страховка, если выжимку никто не делал. */
const MAX_CONTEXT_CHARS = 48_000;

export interface BuiltContext {
  /** Итоговый системный промпт: слои склеены в порядке «общий → режим → персонаж → персона → чат → выжимка → лорбук → виджеты → пожелание» */
  system: string;
  layers: { global: string; mode: string; character: string; persona: string; chat: string; summary: string; lore: string; widgets: string; instruction: string };
  /** Сообщения, которые уйдут модели (без тех, что уже заменены выжимкой) */
  input: ChatMessageInput[];
  temperature: number;
  topP: number;
  maxTokens?: number;
  googleSearch: boolean;
  /** Сколько сообщений заменено выжимкой */
  summarizedCount: number;
  /** Названия записей лорбука, сработавших на этот запрос */
  loreHits: string[];
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

  const raw: ChatMessageInput[] = history
    .filter((m) => m.role !== 'system' && (m.content || m.attachments?.length))
    .map((m) => {
      const images = (m.attachments ?? []).filter((a) => a.kind === 'image' && a.data).map((a) => ({ mime: a.mime, data: a.data! }));
      return {
        role: m.role as 'user' | 'assistant',
        content: messageText(m),
        ...(images.length ? { images } : {}),
      };
    });
  if (tail) raw.push(...tail);
  // Несколько сообщений подряд от одного автора (например, из телефона и из чата) склеиваем в одно: так требуют некоторые провайдеры
  const input: ChatMessageInput[] = [];
  for (const m of raw) {
    const last = input[input.length - 1];
    if (last && last.role === m.role) {
      last.content = [last.content, m.content].filter(Boolean).join('\n\n');
      if (m.images?.length) last.images = [...(last.images ?? []), ...m.images];
    } else input.push({ ...m });
  }

  let total = input.reduce((n, m) => n + m.content.length, 0);
  // Страховочная обрезка: если контекст модели большой, запас пропорционально больше
  const maxChars = Math.max(MAX_CONTEXT_CHARS, Math.round((chat.contextLimit ?? 0) * 3.2 * 0.95));
  while (input.length > 2 && total > maxChars) total -= input.shift()!.content.length;

  const { character, persona } = resolveRp(chat);
  const sub = (t: string) => fillNames(t, character?.name, persona?.name);

  // Лорбук: ищем ключевые слова в нескольких последних сообщениях
  const books = useRp.getState().lorebooks.filter((b) => chat.lorebookIds?.includes(b.id));
  const recent = [...history.map(messageText), ...(tail ?? []).map((t) => t.content)];
  const hits = books.length ? activeEntries(books, recent) : [];

  const layers = {
    global: chat.noGlobalPrompt ? '' : args.globalPrompt.trim(),
    mode: chat.noModePrompt ? '' : mode.systemPrompt,
    character: character ? sub(characterPrompt(character)) : '',
    persona: persona ? sub(`[Пользователь играет за: ${persona.name}]\n${persona.description}`.trim()) : '',
    chat: (chat.systemPrompt ?? '').trim(),
    summary: summary
      ? `Краткое содержание более ранней части этой переписки (самих сообщений ты уже не видишь):\n${summary}`
      : '',
    lore: hits.length
      ? `[Справочная информация. Учитывай её, когда это уместно, не пересказывай дословно]\n${hits.map((e) => sub(e.content.trim())).join('\n\n')}`
      : '',
    widgets: chat.widgets?.length ? widgetPrompt(chat.widgets, foldWidgets(path.map((id) => messages[id]).filter(Boolean))) : '',
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
    loreHits: hits.map((e) => e.name || e.keys[0] || 'Запись'),
  };
}
