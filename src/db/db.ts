import Dexie, { type Table } from 'dexie';
import type { Chat, Message } from '../types';

/**
 * Локальная БД (IndexedDB через Dexie). Работает одинаково в Android WebView и в Tauri.
 *
 * chats:    id, updatedAt            -> список чатов, сортировка по свежести
 * messages: id, chatId, parentId,    -> загрузка всех сообщений чата одним запросом по chatId
 *           [chatId+createdAt]          (дерево собирается в памяти по parentId)
 * kv:       key                      -> крупные данные настроек (например, фон-картинка)
 */
export interface KvRow {
  key: string;
  value: Blob;
}

class AppDB extends Dexie {
  chats!: Table<Chat, string>;
  messages!: Table<Message, string>;
  kv!: Table<KvRow, string>;

  constructor() {
    super('aichat');
    this.version(1).stores({
      chats: 'id, updatedAt',
      messages: 'id, chatId, parentId, [chatId+createdAt]',
    });
    this.version(2).stores({
      chats: 'id, updatedAt',
      messages: 'id, chatId, parentId, [chatId+createdAt]',
      kv: 'key',
    });
  }
}

export const db = new AppDB();
