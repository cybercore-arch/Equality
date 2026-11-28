import { create } from 'zustand';
import { db } from '../db/db';
import { streamChat } from '../providers';
import type { Attachment, Chat, ChatMessageInput, Folder, Message, MessageStats, WidgetOp } from '../types';
import { estimateTokens } from '../lib/tokens';
import { formatHits, webSearch } from '../lib/websearch';
import { buildContext, fillNames, messageText } from './prompt';
import { useRp } from './rp';
import { resolveProvider } from './resolve';
import { useSettings } from './settings';

export const ROOT = '__root__';
const NEW_TITLE = 'Новый чат';
/**
 * Ищет в тексте ответа просьбу о поиске. Основной формат <search>запрос</search>,
 * но модели, обученные на своих «вызовах инструментов», часто пишут по-своему (<invoke name="web_search">, JSON): понимаем и их.
 */
function findSearchRequest(text: string): { index: number; query: string } | null {
  const own = /<search>([\s\S]*?)<\/search>/i.exec(text);
  if (own) return { index: own.index, query: own[1] };
  const inv = /<invoke\b[^>]*name\s*=\s*["'](?:web_search|search|google_search|browser\.search)["'][^>]*>[\s\S]*?<parameter\b[^>]*name\s*=\s*["'](?:query|q|search_query)["'][^>]*>([\s\S]*?)<\/parameter>/i.exec(text);
  if (inv) {
    const starts = ['<tool_call', 'tool_call>', '<function_call', '<invoke'].map((m) => text.lastIndexOf(m, inv.index + 7)).filter((i) => i >= 0);
    return { index: Math.min(inv.index, ...starts), query: inv[1] };
  }
  const json = /"name"\s*:\s*"(?:web_search|search)"[\s\S]{0,80}?"(?:query|q)"\s*:\s*"([^"]+)"/i.exec(text);
  if (json) return { index: Math.max(0, text.lastIndexOf('{', json.index)), query: json[1] };
  return null;
}

const CONTINUE_PROMPT = 'Продолжи свой предыдущий ответ ровно с того места, где он оборвался. Не повторяй уже написанное.';

const SUMMARY_SYSTEM =
  'Ты сжимаешь историю переписки, чтобы её можно было продолжить позже без потери смысла. ' +
  'Напиши сжатую выжимку на языке переписки: ключевые факты, имена, договорённости, решения, ' +
  'состояние сюжета или задачи, важные детали и настроение. ' +
  'Если даны предыдущая выжимка и новые сообщения, объедини их в одну цельную выжимку. ' +
  'В сообщениях могут встречаться служебные теги (<phone from="Имя">…</phone> и строки «📱 Сообщение для Имя: …» это переписка в телефоне, <status …/> параметры, <roll> и «🎲» броски кубиков). ' +
  'Это часть истории: перескажи важное из телефонной переписки (кто, с кем и о чём договорился), последние значения параметров и итоги бросков словами. Сами теги в выжимку не вставляй. ' +
  'Пиши от третьего лица, без вступлений и комментариев, не длиннее 450 слов.';
/** Сколько последних сообщений остаются нетронутыми при сжатии */
const KEEP_RECENT = 6;

let abortCtl: AbortController | null = null;
let lastTs = 0;
const now = () => (lastTs = Math.max(Date.now(), lastTs + 1)); // монотонное время для порядка сообщений
const uid = () => crypto.randomUUID();
const keyOf = (parentId: string | null) => parentId ?? ROOT;

type MsgMap = Record<string, Message>;
type Children = Record<string, string[]>;

function indexMessages(list: Message[]) {
  const messages: MsgMap = {};
  const children: Children = {};
  for (const m of list) messages[m.id] = m;
  for (const m of [...list].sort((a, b) => a.createdAt - b.createdAt)) {
    (children[keyOf(m.parentId)] ??= []).push(m.id);
  }
  return { messages, children };
}

/** Путь от корня до сообщения: это и есть "текущая переписка". */
function pathTo(messages: MsgMap, leafId: string | null): string[] {
  const out: string[] = [];
  let cur = leafId;
  while (cur && messages[cur]) {
    out.push(cur);
    cur = messages[cur].parentId;
  }
  return out.reverse();
}

/** Спуститься по самой свежей ветке до конца (нужно при переключении свайпа). */
function descend(children: Children, id: string): string {
  let cur = id;
  for (;;) {
    const ch = children[cur];
    if (!ch?.length) return cur;
    cur = ch[ch.length - 1];
  }
}

interface GenOpts {
  /** Разовое пожелание к ответу: уходит модели только в этот раз и в историю не попадает */
  instruction?: string;
  /** Дописать уже существующий ответ */
  continueId?: string;
}

interface ChatState {
  chats: Chat[];
  folders: Folder[];
  chatId: string | null;
  messages: MsgMap;
  children: Children;
  /** id сообщений текущей ветки по порядку — именно их рисует виртуальный список */
  path: string[];
  streamingId: string | null;
  /** Текст стримящегося сообщения: обновляется отдельно, чтобы не трогать остальной список */
  streamText: string;
  /** Пояснение вместо стадии ответа, например «Модель перегружена, пробую снова» */
  statusNote: string | null;
  /** Идёт сжатие контекста */
  summarizing: boolean;
  /** Нейтральное сообщение для пользователя (например, «контекст сжат автоматически»), привязано к чату */
  notice: { chatId: string; text: string } | null;
  clearNotice: () => void;
  error: string | null;

  init: () => Promise<void>;
  newChat: () => Promise<void>;
  selectChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  /** Изменить поля чата (режим, модель, папка) */
  updateChat: (id: string, patch: Partial<Chat>) => Promise<void>;
  setChatMode: (id: string, modeId: string) => Promise<void>;

  createFolder: (name: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  toggleFolder: (id: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  /** Начать игру с персонажем: приветствие становится первым сообщением (остальные приветствия — свайпами) */
  startWithCharacter: (characterId: string, personaId?: string) => Promise<void>;
  /** Ветка: копия переписки до выбранного сообщения в новом чате */
  forkFrom: (messageId: string) => Promise<void>;
  /** reply: false — только добавить сообщение, модель ответит позже, когда пользователь попросит */
  send: (text: string, attachments?: Attachment[], widgetOps?: WidgetOp[], opts?: { reply?: boolean }) => Promise<void>;
  regenerate: (instruction?: string) => Promise<void>;
  /** Повторить запрос, если на последнее сообщение пользователя не пришёл ответ */
  retry: () => Promise<void>;
  continueMessage: (id: string) => Promise<void>;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  swipe: (messageId: string, dir: -1 | 1) => Promise<void>;
  /** Сжать старую часть переписки в выжимку (сами сообщения не удаляются) */
  summarizeContext: (opts?: { auto?: boolean }) => Promise<'ok' | 'skip' | 'abort'>;
  /** Вручную поправить текст выжимки; пустой текст сбрасывает её */
  setSummary: (text: string) => Promise<void>;
  stop: () => void;
  clearError: () => void;
}

export const useChat = create<ChatState>((set, get) => {
  const currentChat = () => get().chats.find((c) => c.id === get().chatId);

  const sortChats = (chats: Chat[]) => [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  async function saveLeaf(leafId: string | null, extra: Partial<Chat> = {}) {
    const chat = currentChat();
    if (!chat) return;
    const patch = { leafId, updatedAt: Date.now(), ...extra };
    await db.chats.update(chat.id, patch);
    set((s) => ({ chats: sortChats(s.chats.map((c) => (c.id === chat.id ? { ...c, ...patch } : c))) }));
  }

  /** Добавляет сообщение в память и делает его концом текущей ветки. */
  function putMessage(m: Message) {
    set((s) => {
      const messages = { ...s.messages, [m.id]: m };
      const k = keyOf(m.parentId);
      const children = { ...s.children, [k]: [...(s.children[k] ?? []), m.id] };
      return { messages, children, path: pathTo(messages, m.id) };
    });
  }

  function removeMessage(m: Message) {
    set((s) => {
      const messages = { ...s.messages };
      delete messages[m.id];
      const k = keyOf(m.parentId);
      const children = { ...s.children, [k]: (s.children[k] ?? []).filter((x) => x !== m.id) };
      return { messages, children, path: pathTo(messages, m.parentId) };
    });
  }

  /** Пора ли сжимать: оценка запроса перевалила за 80% от размера контекста модели (или за 16K, если он неизвестен). */
  function needsAutoSummary(chat: Chat, ctx: ReturnType<typeof buildContext>): boolean {
    if (!useSettings.getState().autoSummary || chat.noAutoSummary) return false;
    const limit = chat.contextLimit ?? 16_000;
    const tokens = estimateTokens(ctx.system) + ctx.input.reduce((n, m) => n + estimateTokens(m.content), 0);
    return tokens > limit * 0.8;
  }

  async function runGeneration(parentId: string | null, opts: GenOpts = {}) {
    const chat = currentChat();
    if (!chat) return;

    const settings = useSettings.getState();
    const provider = resolveProvider(chat, settings);

    if (!provider.apiKey.trim() && provider.id !== 'custom') {
      set({ error: `Добавь API-ключ для «${provider.name}» в настройках.` });
      return;
    }
    if (!provider.model.trim()) {
      set({ error: 'Укажи название модели: нажми на название модели вверху.' });
      return;
    }

    // Дописывание: показываем модели её же незаконченный ответ и просим продолжить
    const existing = opts.continueId ? get().messages[opts.continueId] : undefined;
    let webResults = '';
    let webTool = false;
    let tailOverride: ChatMessageInput[] | undefined;
    const build = () => buildContext({
      chat: currentChat() ?? chat,
      messages: get().messages,
      path: pathTo(get().messages, parentId),
      globalPrompt: settings.globalPrompt,
      searchEnabled: settings.searchEnabled,
      instruction: opts.instruction,
      webResults,
      webTool,
      tail: tailOverride ?? (existing
        ? [
            { role: 'assistant', content: existing.content },
            { role: 'user', content: CONTINUE_PROMPT },
          ]
        : undefined),
    });
    let ctx = build();

    const base = existing?.content ?? '';
    const assistant: Message = existing ?? {
      id: uid(),
      chatId: chat.id,
      parentId,
      role: 'assistant',
      content: '',
      createdAt: now(),
      model: provider.model,
    };
    if (!existing) putMessage(assistant);
    set({ streamingId: assistant.id, streamText: base, error: null });

    // Автосжатие: если контекст почти заполнен, сначала сжимаем старую часть переписки
    if (!existing && needsAutoSummary(chat, ctx)) {
      set({ statusNote: 'Контекст почти заполнен, сжимаю старую часть переписки…' });
      const res = await get().summarizeContext({ auto: true });
      set({ statusNote: null });
      if (res === 'abort') {
        removeMessage(assistant);
        await saveLeaf(parentId);
        set({ streamingId: null, streamText: '' });
        return;
      }
      if (res === 'ok') {
        ctx = build();
        set({
          notice: {
            chatId: chat.id,
            text: 'Контекст был почти заполнен, поэтому старая часть переписки автоматически сжата в выжимку. Посмотреть и поправить её: настройки чата → Контекст. Отключить автосжатие: Настройки → Автосжатие контекста.',
          },
        });
      }
    }

    // Поиск в интернете: модель сама просит его тегом <search>запрос</search> (у Gemini с поиском Google свой поиск)
    const searchKey = settings.searchKeys[settings.searchProvider]?.trim();
    if (chat.webSearch && !existing && !(ctx.googleSearch && provider.id === 'gemini')) {
      if (!searchKey) {
        set({ notice: { chatId: chat.id, text: 'Поиск в интернете включён, но ключ поиска не введён: Настройки → Поиск в интернете.' } });
      } else {
        webTool = true;
        // Режим «искать всегда» для моделей, которые сами тег не пишут: ищем по последнему сообщению до ответа
        if (chat.webSearchAlways) {
          const lastUser = pathTo(get().messages, parentId)
            .map((id) => get().messages[id])
            .reverse()
            .find((m) => m?.role === 'user');
          const q = (lastUser?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
          if (q) {
            set({ statusNote: `Ищу в интернете: ${q}` });
            try {
              webResults = formatHits(q, await webSearch(settings.searchProvider, searchKey, q)) || '';
            } catch (e) {
              set({ notice: { chatId: chat.id, text: `Поиск не сработал, отвечаю без него. ${e instanceof Error ? e.message : String(e)}` } });
            }
            set({ statusNote: null });
          }
        }
        ctx = build();
      }
    }

    abortCtl = new AbortController();
    const signal = abortCtl.signal;
    let acc = base;
    let raf = 0;
    // Батчим обновления: максимум одно обновление интерфейса за кадр, сколько бы чанков ни пришло
    const flush = () => {
      raf = 0;
      set({ streamText: acc });
    };

    const t0 = performance.now();
    let tFirst: number | null = null;
    let completionTokens: number | undefined;
    let promptTokens: number | undefined;
    let attempt = 0;

    try {
      for (let round = 0; ; round++) {
        const segStart = acc.length;
        attempt = 0;
        // Если модель перегружена (5xx) и текст ещё не пошёл, тихо повторяем запрос до двух раз
        for (;;) {
          try {
            const stream = streamChat(provider, {
              messages: ctx.input,
              system: ctx.system,
              temperature: ctx.temperature,
              topP: ctx.topP,
              maxTokens: ctx.maxTokens,
              googleSearch: ctx.googleSearch && provider.id === 'gemini',
              signal,
              onUsage: (u) => {
                if (u.completion !== undefined) completionTokens = u.completion;
                if (u.prompt !== undefined) promptTokens = u.prompt;
              },
            });
            for await (const chunk of stream) {
              if (tFirst === null) tFirst = performance.now() - t0;
              acc += chunk;
              if (!raf) raf = requestAnimationFrame(flush);
            }
            break;
          } catch (e) {
            const status = (e as { status?: number }).status;
            const retryable = acc.length === segStart && attempt < 2 && status !== undefined && status >= 500 && !signal.aborted;
            if (!retryable) throw e;
            attempt++;
            set({ statusNote: `Модель перегружена, пробую снова (${attempt}/2)…` });
            await new Promise((r) => setTimeout(r, attempt * 2500));
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          }
        }
        // Модель попросила поиск: ищем и продолжаем ответ уже с результатами
        const m = webTool ? findSearchRequest(acc.slice(segStart)) : null;
        if (!m) break;
        const before = acc.slice(0, segStart + m.index).trimEnd();
        acc = before;
        flush();
        const query = m.query.replace(/\s+/g, ' ').trim().slice(0, 300);
        if (!query || round >= 2) break;
        set({ statusNote: `Ищу в интернете: ${query}` });
        try {
          const hits = await webSearch(settings.searchProvider, searchKey!, query, signal);
          webResults = formatHits(query, hits) || `[Поиск по запросу «${query}» ничего не нашёл. Ответь без него и скажи об этом.]`;
        } catch (e) {
          if (signal.aborted) throw e;
          webResults = '[Поиск не удался. Ответь без него и коротко скажи об этом.]';
          set({ notice: { chatId: chat.id, text: `Поиск не сработал. ${e instanceof Error ? e.message : String(e)}` } });
        }
        tailOverride = before ? [{ role: 'assistant', content: before }, { role: 'user', content: CONTINUE_PROMPT }] : undefined;
        ctx = build();
        set({ statusNote: null });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        set({ error: (e as Error).message || 'Неизвестная ошибка' });
      }
    } finally {
      if (raf) cancelAnimationFrame(raf);
      abortCtl = null;
      set({ statusNote: null });
    }

    if (acc === base) {
      // Ничего нового не получили: пустой ответ убираем, а у дописываемого просто снимаем «стриминг»
      if (!existing) {
        removeMessage(assistant);
        await saveLeaf(parentId);
      }
      set({ streamingId: null, streamText: '' });
      return;
    }

    const totalMs = performance.now() - t0;
    const gained = acc.length - base.length;
    const stats: MessageStats = {
      ttftMs: Math.round(tFirst ?? totalMs),
      totalMs: Math.round(totalMs),
      tokens: completionTokens ?? Math.max(1, Math.round(gained / 3.2)),
      approx: completionTokens === undefined,
      promptTokens,
    };

    const done: Message = { ...assistant, content: acc, stats: existing ? (existing.stats ?? stats) : stats };
    set((s) => ({ messages: { ...s.messages, [done.id]: done }, streamingId: null, streamText: '' }));
    await db.messages.put(done);
    await saveLeaf(done.id);
  }

  return {
    chats: [],
    folders: [],
    chatId: null,
    messages: {},
    children: {},
    path: [],
    streamingId: null,
    streamText: '',
    statusNote: null,
    summarizing: false,
    notice: null,
    clearNotice: () => set({ notice: null }),
    error: null,

    async init() {
      void useRp.getState().load();
      const [chats, folders] = await Promise.all([
        db.chats.orderBy('updatedAt').reverse().toArray(),
        db.folders.orderBy('createdAt').toArray(),
      ]);
      set({ chats, folders });
      if (chats.length) await get().selectChat(chats[0].id);
      else await get().newChat();
    },

    async newChat() {
      // Если текущий чат пустой, второй пустой не создаём
      const cur = currentChat();
      if (cur && get().path.length === 0 && cur.title === NEW_TITLE) return;
      get().stop();
      const t = Date.now();
      const chat: Chat = {
        id: uid(),
        title: NEW_TITLE,
        leafId: null,
        createdAt: t,
        updatedAt: t,
        modeId: useSettings.getState().modeId,
        folderId: null,
      };
      await db.chats.put(chat);
      set((s) => ({
        chats: [chat, ...s.chats],
        chatId: chat.id,
        messages: {},
        children: {},
        path: [],
        error: null,
      }));
    },

    async selectChat(id) {
      get().stop();
      const chat = get().chats.find((c) => c.id === id);
      if (!chat) return;
      const list = await db.messages.where('chatId').equals(id).toArray();
      const { messages, children } = indexMessages(list);
      set({ chatId: id, messages, children, path: pathTo(messages, chat.leafId), error: null });
    },

    async deleteChat(id) {
      get().stop();
      await db.transaction('rw', db.chats, db.messages, async () => {
        await db.messages.where('chatId').equals(id).delete();
        await db.chats.delete(id);
      });
      const chats = get().chats.filter((c) => c.id !== id);
      set({ chats });
      if (get().chatId === id) {
        if (chats.length) await get().selectChat(chats[0].id);
        else await get().newChat();
      }
    },

    async updateChat(id, patch) {
      await db.chats.update(id, patch);
      set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    },

    async renameChat(id, title) {
      const t = title.trim();
      if (!t) return;
      await get().updateChat(id, { title: t.slice(0, 80) });
    },

    async setChatMode(id, modeId) {
      await get().updateChat(id, { modeId });
      useSettings.getState().setMode(modeId); // запоминаем как режим для следующих новых чатов
    },

    async createFolder(name) {
      const n = name.trim();
      if (!n) return;
      const folder: Folder = { id: uid(), name: n.slice(0, 40), collapsed: false, createdAt: now() };
      await db.folders.put(folder);
      set((s) => ({ folders: [...s.folders, folder] }));
    },

    async renameFolder(id, name) {
      const n = name.trim();
      if (!n) return;
      await db.folders.update(id, { name: n.slice(0, 40) });
      set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name: n.slice(0, 40) } : f)) }));
    },

    async toggleFolder(id) {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      await db.folders.update(id, { collapsed: !f.collapsed });
      set((s) => ({ folders: s.folders.map((x) => (x.id === id ? { ...x, collapsed: !x.collapsed } : x)) }));
    },

    async deleteFolder(id) {
      // Чаты из удаляемой папки не пропадают, а возвращаются в общий список
      const inside = get().chats.filter((c) => c.folderId === id);
      await Promise.all(inside.map((c) => db.chats.update(c.id, { folderId: null })));
      await db.folders.delete(id);
      set((s) => ({
        folders: s.folders.filter((f) => f.id !== id),
        chats: s.chats.map((c) => (c.folderId === id ? { ...c, folderId: null } : c)),
      }));
    },

    async forkFrom(messageId) {
      const { messages, path, streamingId } = get();
      const src = currentChat();
      const i = path.indexOf(messageId);
      if (!src || streamingId || i < 0) return;
      const chatId = uid();
      const idMap: Record<string, string> = {};
      const copies: Message[] = [];
      let parent: string | null = null;
      for (const id of path.slice(0, i + 1)) {
        const nid = uid();
        idMap[id] = nid;
        copies.push({ ...messages[id], id: nid, chatId, parentId: parent, createdAt: now() });
        parent = nid;
      }
      const t = Date.now();
      const keepSummary = src.summaryUpToId && idMap[src.summaryUpToId];
      const chat: Chat = {
        ...src,
        id: chatId,
        title: `${src.title} (ветка)`.slice(0, 80),
        leafId: parent,
        createdAt: t,
        updatedAt: t,
        summary: keepSummary ? src.summary : undefined,
        summaryUpToId: keepSummary ? idMap[src.summaryUpToId!] : undefined,
      };
      await db.messages.bulkPut(copies);
      await db.chats.put(chat);
      set((s) => ({ chats: [chat, ...s.chats] }));
      await get().selectChat(chatId);
    },

    async startWithCharacter(characterId, personaId) {
      const ch = useRp.getState().characters.find((c) => c.id === characterId);
      if (!ch) return;
      get().stop();
      let cur = currentChat();
      if (!cur || get().path.length > 0) {
        const t = Date.now();
        cur = { id: uid(), title: NEW_TITLE, leafId: null, createdAt: t, updatedAt: t, folderId: null };
        await db.chats.put(cur);
        set((s) => ({ chats: [cur!, ...s.chats], chatId: cur!.id, messages: {}, children: {}, path: [], error: null }));
      }
      const { personas } = useRp.getState();
      const pid = personaId ?? cur.personaId ?? useSettings.getState().defaultPersonaId;
      const userName = personas.find((p) => p.id === pid)?.name;
      const greetings = [ch.firstMessage, ...ch.alternateGreetings].map((g) => g.trim()).filter(Boolean);
      const msgs: Message[] = greetings.map((g) => ({
        id: uid(),
        chatId: cur!.id,
        parentId: null,
        role: 'assistant',
        content: fillNames(g, ch.name, userName),
        createdAt: now(),
      }));
      await db.messages.bulkPut(msgs);
      for (const m of msgs) putMessage(m);
      await saveLeaf(msgs[0]?.id ?? null, { characterId, modeId: 'rp', title: ch.name.slice(0, 40), lorebookIds: ch.lorebookId ? [ch.lorebookId] : undefined, ...(personaId ? { personaId } : {}) });
      if (msgs[0]) set((st) => ({ path: pathTo(st.messages, msgs[0].id) }));
    },

    async send(text, attachments, widgetOps, opts) {
      const body = text.trim();
      const chat = currentChat();
      if ((!body && !attachments?.length) || !chat || get().streamingId) return;

      const leafId = get().path[get().path.length - 1] ?? null;
      const user: Message = {
        id: uid(),
        chatId: chat.id,
        parentId: leafId,
        role: 'user',
        content: body,
        createdAt: now(),
        ...(attachments?.length ? { attachments } : {}),
        ...(widgetOps?.length ? { widgetOps } : {}),
      };
      putMessage(user);
      await db.messages.put(user);
      await saveLeaf(user.id, chat.title === NEW_TITLE ? { title: (body || attachments?.[0]?.name || NEW_TITLE).slice(0, 40) } : {});
      if (opts?.reply !== false) await runGeneration(user.id);
    },

    /** Новый вариант ответа ("свайп"): создаём соседа последнего ответа ИИ */
    async regenerate(instruction) {
      const { path, messages, streamingId } = get();
      const last = messages[path[path.length - 1]];
      if (streamingId || !last || last.role !== 'assistant') return;
      await runGeneration(last.parentId, { instruction });
    },

    async retry() {
      const { path, messages, streamingId } = get();
      const last = messages[path[path.length - 1]];
      if (streamingId || !last || last.role !== 'user') return;
      await runGeneration(last.id);
    },

    async continueMessage(id) {
      const { path, messages, streamingId } = get();
      const m = messages[id];
      if (streamingId || !m || m.role !== 'assistant' || path[path.length - 1] !== id) return;
      await runGeneration(m.parentId, { continueId: id });
    },

    async editMessage(id, content) {
      const m = get().messages[id];
      const text = content.trim();
      if (!m || !text || get().streamingId) return;
      const next: Message = { ...m, content: text };
      set((s) => ({ messages: { ...s.messages, [id]: next } }));
      await db.messages.put(next);
    },

    /** Удаляет сообщение вместе со всем, что от него ответвляется. */
    async deleteMessage(id) {
      const { messages, children, streamingId, path } = get();
      const m = messages[id];
      if (!m || streamingId) return;

      const ids: string[] = [];
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        ids.push(cur);
        stack.push(...(children[cur] ?? []));
      }

      const sibs = (children[keyOf(m.parentId)] ?? []).filter((x) => x !== id);
      const msgs: MsgMap = { ...messages };
      const ch: Children = { ...children };
      for (const x of ids) {
        delete msgs[x];
        delete ch[x];
      }
      ch[keyOf(m.parentId)] = sibs;

      await db.messages.bulkDelete(ids);

      if (path.includes(id)) {
        // Если остался другой вариант ответа, показываем его, иначе откатываемся к родителю
        const leaf = sibs.length ? descend(ch, sibs[sibs.length - 1]) : m.parentId;
        set({ messages: msgs, children: ch, path: pathTo(msgs, leaf) });
        await saveLeaf(leaf);
      } else {
        set({ messages: msgs, children: ch });
      }
    },

    async swipe(messageId, dir) {
      const { messages, children, streamingId } = get();
      const m = messages[messageId];
      if (!m || streamingId) return;
      const sibs = children[keyOf(m.parentId)] ?? [];
      const target = sibs[sibs.indexOf(messageId) + dir];
      if (!target) return;
      const leaf = descend(children, target);
      set({ path: pathTo(messages, leaf) });
      await saveLeaf(leaf);
    },

    async summarizeContext(opts) {
      const auto = !!opts?.auto;
      const chat = currentChat();
      const { path, messages, streamingId, summarizing } = get();
      if (!chat || (streamingId && !auto) || summarizing) return 'skip';

      // Сжимаем всё, что ещё не сжато, кроме нескольких последних сообщений
      const prevIdx = chat.summaryUpToId ? path.indexOf(chat.summaryUpToId) : -1;
      const startIdx = prevIdx + 1;
      const cutoff = path.length - 1 - KEEP_RECENT;
      // При автосжатии ждём, пока накопится заметный кусок, чтобы не сжимать после каждого сообщения
      if (cutoff < startIdx + (auto ? 3 : 1)) {
        if (!auto) set({ error: 'Пока нечего сжимать: в чате мало новых сообщений.' });
        return 'skip';
      }

      const settings = useSettings.getState();
      const provider = resolveProvider(chat, settings);
      if (!provider.apiKey.trim() && provider.id !== 'custom') {
        if (!auto) set({ error: `Добавь API-ключ для «${provider.name}» в настройках.` });
        return 'skip';
      }

      const chunk = path
        .slice(startIdx, cutoff + 1)
        .map((id) => messages[id])
        .filter((m) => m && m.role !== 'system' && (m.content || m.attachments?.length));
      let transcript = chunk.map((m) => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${messageText(m)}`).join('\n\n');
      if (transcript.length > 80_000) transcript = transcript.slice(-80_000);
      const prev = prevIdx >= 0 ? (chat.summary ?? '').trim() : '';
      const prompt = (prev ? `Предыдущая выжимка:\n${prev}\n\nНовые сообщения:\n` : 'Сообщения:\n') + transcript;

      set({ summarizing: true, error: null });
      abortCtl = new AbortController();
      let acc = '';
      let aborted = false;
      let failed = '';
      try {
        const stream = streamChat(provider, {
          messages: [{ role: 'user', content: prompt }],
          system: SUMMARY_SYSTEM,
          temperature: 0.3,
          topP: 0.9,
          googleSearch: false,
          signal: abortCtl.signal,
        });
        for await (const part of stream) acc += part;
      } catch (e) {
        if ((e as Error).name === 'AbortError') aborted = true;
        else failed = (e as Error).message || 'Не удалось сжать контекст';
      } finally {
        abortCtl = null;
        set({ summarizing: false });
      }

      if (aborted) return 'abort';
      if (failed) {
        if (auto) set({ notice: { chatId: chat.id, text: 'Контекст почти заполнен, но сжать его автоматически не получилось. Ответ всё равно будет сгенерирован. Можно сжать вручную: настройки чата → Контекст.' } });
        else set({ error: failed });
        return 'skip';
      }
      if (!acc.trim()) return 'skip';
      await get().updateChat(chat.id, { summary: acc.trim(), summaryUpToId: path[cutoff] });
      return 'ok';
    },

    async setSummary(text) {
      const chat = currentChat();
      if (!chat) return;
      const t = text.trim();
      await get().updateChat(chat.id, t ? { summary: t } : { summary: undefined, summaryUpToId: undefined });
    },

    stop() {
      abortCtl?.abort();
    },

    clearError() {
      set({ error: null });
    },
  };
});
