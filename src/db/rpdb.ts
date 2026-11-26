import Dexie, { type Table } from 'dexie';
import type { Character, Persona } from '../types';

/**
 * База ролплея лежит отдельно от основной (чаты и сообщения): так новые таблицы
 * не меняют схему основной базы и старую версию приложения можно вернуть без потери чатов.
 */
class RpDB extends Dexie {
  characters!: Table<Character, string>;
  personas!: Table<Persona, string>;

  constructor() {
    super('equality-rp');
    this.version(1).stores({
      characters: 'id, name, updatedAt',
      personas: 'id, name, updatedAt',
    });
  }
}

export const rpdb = new RpDB();
