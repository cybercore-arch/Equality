import { create } from 'zustand';
import { db } from '../db/db';
import { getMode } from '../modes';
import { streamChat } from '../providers';
import type { Chat, ChatMessageInput, Message } from '../types';
import { useSettings } from './settings';

export const ROOT = '__root__';
const NEW_TITLE = 'Новый чат';
/** Грубая обрезка контекста по символам. Умная суммаризация — на Этапе 3. */
const MAX_CONTEXT_CHARS = 48_000;

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

interface ChatState {
  chats: Chat[];
  chatId: string | null;
  messages: MsgMap;
  children: Children;
  /** id сообщений текущей ветки по порядку — именно их рисует виртуальный список */
  path: string[];
  streamingId: string | null;
  /** Текст стримящегося сообщения: обновляется отдельно, чтобы не трогать остальной список */
  streamText: string;
  error: string | null;

  init: () => Promise<void>;
  newChat: () => Promise<void>;
  selectChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  swipe: (messageId: string, dir: -1 | 1) => Promise<void>;
  stop: () => void;
  clearError: () => void;
}

export const useChat = create<ChatState>((set, get) => {
  const currentChat = () => get().chats.find((c) => c.id === get().chatId);

  async function saveLeaf(leafId: string | null, extra: Partial<Chat> = {}) {
    const chat = currentChat();
    if (!chat) return;
    const patch = { leafId, updatedAt: Date.now(), ...extra };
    await db.chats.update(chat.id, patch);
    set((s) => ({
      chats: s.chats
        .map((c) => (c.id === chat.id ? { ...c, ...patch } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }));
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

  async function runGeneration(parentId: string | null) {
    const chat = currentChat();
    if (!chat) return;

    const settings = useSettings.getState();
    const provider = settings.providers.find((p) => p.id === settings.activeProvider)!;
    const mode = getMode(settings.modeId);

    if (!provider.apiKey.trim()) {
      set({ error: `Добавь API-ключ для «${provider.name}» в настройках (⚙).` });
      return;
    }
    if (!provider.model.trim()) {
      set({ error: 'Укажи название модели в настройках (⚙).' });
      return;
    }

    // Контекст = путь до родителя включительно (без нового ответа)
    const history = pathTo(get().messages, parentId).map((id) => get().messages[id]);
    const input: ChatMessageInput[] = history
      .filter((m) => m.role !== 'system' && m.content)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    let total = input.reduce((n, m) => n + m.content.length, 0);
    while (input.length > 2 && total > MAX_CONTEXT_CHARS) total -= input.shift()!.content.length;

    const assistant: Message = {
      id: uid(),
      chatId: chat.id,
      parentId,
      role: 'assistant',
      content: '',
      createdAt: now(),
      model: provider.model,
    };
    putMessage(assistant);
    set({ streamingId: assistant.id, streamText: '', error: null });

    abortCtl = new AbortController();
    let acc = '';
    let raf = 0;
    // Батчим обновления: максимум одно обновление интерфейса за кадр, сколько бы чанков ни пришло
    const flush = () => {
      raf = 0;
      set({ streamText: acc });
    };

    try {
      const stream = streamChat(provider, {
        messages: input,
        system: mode.systemPrompt,
        temperature: mode.temperature,
        topP: mode.topP,
        googleSearch: mode.googleSearch && provider.id === 'gemini',
        signal: abortCtl.signal,
      });
      for await (const chunk of stream) {
        acc += chunk;
        if (!raf) raf = requestAnimationFrame(flush);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        set({ error: (e as Error).message || 'Неизвестная ошибка' });
      }
    } finally {
      if (raf) cancelAnimationFrame(raf);
      abortCtl = null;
    }

    if (!acc) {
      // Ничего не получили — убираем пустой ответ
      removeMessage(assistant);
      set({ streamingId: null, streamText: '' });
      await saveLeaf(parentId);
      return;
    }

    const done: Message = { ...assistant, content: acc };
    set((s) => ({ messages: { ...s.messages, [done.id]: done }, streamingId: null, streamText: '' }));
    await db.messages.put(done);
    await saveLeaf(done.id);
  }

  return {
    chats: [],
    chatId: null,
    messages: {},
    children: {},
    path: [],
    streamingId: null,
    streamText: '',
    error: null,

    async init() {
      const chats = await db.chats.orderBy('updatedAt').reverse().toArray();
      set({ chats });
      if (chats.length) await get().selectChat(chats[0].id);
      else await get().newChat();
    },

    async newChat() {
      get().stop();
      const t = Date.now();
      const chat: Chat = { id: uid(), title: NEW_TITLE, leafId: null, createdAt: t, updatedAt: t };
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
    async regenerate() {
      const { path, messages, streamingId } = get();
      const last = messages[path[path.length - 1]];
      if (streamingId || !last || last.role !== 'assistant') return;
      await runGeneration(last.parentId);
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
