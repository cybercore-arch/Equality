import Dexie, { type Table } from 'dexie';
import type { Character, Lorebook, Persona } from '../types';

/**
 * База ролплея лежит отдельно от основной (чаты и сообщения): так новые таблицы
 * не меняют схему основной базы и старую версию приложения можно вернуть без потери чатов.
 */
class RpDB extends Dexie {
  characters!: Table<Character, string>;
  personas!: Table<Persona, string>;
  lorebooks!: Table<Lorebook, string>;

  constructor() {
    super('equality-rp');
    this.version(1).stores({
      characters: 'id, name, updatedAt',
      personas: 'id, name, updatedAt',
    });
    this.version(2).stores({
      characters: 'id, name, updatedAt',
      personas: 'id, name, updatedAt',
      lorebooks: 'id, name, updatedAt',
    });
  }
}

export const rpdb = new RpDB();
