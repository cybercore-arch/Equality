import { create } from 'zustand';
import { db } from '../db/db';
import { getMode } from '../modes';
import { streamChat } from '../providers';
import type { Chat, ChatMessageInput, Folder, Message, MessageStats } from '../types';
import { resolveProvider } from './resolve';
import { useSettings } from './settings';

export const ROOT = '__root__';
const NEW_TITLE = 'Новый чат';
/** Грубая обрезка контекста по символам. Умная суммаризация — в Этапе 3B. */
const MAX_CONTEXT_CHARS = 48_000;
const CONTINUE_PROMPT = 'Продолжи свой предыдущий ответ ровно с того места, где он оборвался. Не повторяй уже написанное.';

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

  send: (text: string) => Promise<void>;
  regenerate: (instruction?: string) => Promise<void>;
  /** Повторить запрос, если на последнее сообщение пользователя не пришёл ответ */
  retry: () => Promise<void>;
  continueMessage: (id: string) => Promise<void>;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  swipe: (messageId: string, dir: -1 | 1) => Promise<void>;
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

  async function runGeneration(parentId: string | null, opts: GenOpts = {}) {
    const chat = currentChat();
    if (!chat) return;

    const settings = useSettings.getState();
    const provider = resolveProvider(chat, settings);
    const mode = getMode(chat.modeId ?? 'general');

    if (!provider.apiKey.trim() && provider.id !== 'custom') {
      set({ error: `Добавь API-ключ для «${provider.name}» в настройках.` });
      return;
    }
    if (!provider.model.trim()) {
      set({ error: 'Укажи название модели: нажми на название модели вверху.' });
      return;
    }

    // Контекст = путь до родителя включительно (без нового ответа)
    const history = pathTo(get().messages, parentId).map((id) => get().messages[id]);
    const input: ChatMessageInput[] = history
      .filter((m) => m.role !== 'system' && m.content)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Дописывание: показываем модели её же незаконченный ответ и просим продолжить
    const existing = opts.continueId ? get().messages[opts.continueId] : undefined;
    if (existing) {
      input.push({ role: 'assistant', content: existing.content }, { role: 'user', content: CONTINUE_PROMPT });
    }

    let total = input.reduce((n, m) => n + m.content.length, 0);
    while (input.length > 2 && total > MAX_CONTEXT_CHARS) total -= input.shift()!.content.length;

    const system = opts.instruction?.trim()
      ? `${mode.systemPrompt}\n\n[Пожелание пользователя к этому ответу: ${opts.instruction.trim()}]`
      : mode.systemPrompt;

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
      // Если модель перегружена (5xx) и текст ещё не пошёл, тихо повторяем запрос до двух раз
      for (;;) {
        try {
          const stream = streamChat(provider, {
            messages: input,
            system,
            temperature: mode.temperature,
            topP: mode.topP,
            googleSearch: mode.googleSearch && settings.searchEnabled && provider.id === 'gemini',
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
          const retryable = acc === base && attempt < 2 && status !== undefined && status >= 500 && !signal.aborted;
          if (!retryable) throw e;
          attempt++;
          set({ statusNote: `Модель перегружена, пробую снова (${attempt}/2)…` });
          await new Promise((r) => setTimeout(r, attempt * 2500));
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        }
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
    error: null,

    async init() {
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

    async send(text) {
      const body = text.trim();
      const chat = currentChat();
      if (!body || !chat || get().streamingId) return;

      const leafId = get().path[get().path.length - 1] ?? null;
      const user: Message = {
        id: uid(),
        chatId: chat.id,
        parentId: leafId,
        role: 'user',
        content: body,
        createdAt: now(),
      };
      putMessage(user);
      await db.messages.put(user);
      await saveLeaf(user.id, chat.title === NEW_TITLE ? { title: body.slice(0, 40) } : {});
      await runGeneration(user.id);
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

    stop() {
      abortCtl?.abort();
    },

    clearError() {
      set({ error: null });
    },
  };
});
