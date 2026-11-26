import { create } from 'zustand';
import { rpdb } from '../db/rpdb';
import type { Character, Persona } from '../types';

interface RpState {
  characters: Character[];
  personas: Persona[];
  loaded: boolean;
  load: () => Promise<void>;
  saveCharacter: (c: Character) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  savePersona: (p: Persona) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ru');

export const useRp = create<RpState>((set, get) => ({
  characters: [],
  personas: [],
  loaded: false,

  async load() {
    if (get().loaded) return;
    const [characters, personas] = await Promise.all([rpdb.characters.toArray(), rpdb.personas.toArray()]);
    set({ characters: characters.sort(byName), personas: personas.sort(byName), loaded: true });
  },

  async saveCharacter(c) {
    const next = { ...c, updatedAt: Date.now() };
    await rpdb.characters.put(next);
    set((s) => ({ characters: [...s.characters.filter((x) => x.id !== c.id), next].sort(byName) }));
  },

  async deleteCharacter(id) {
    await rpdb.characters.delete(id);
    set((s) => ({ characters: s.characters.filter((x) => x.id !== id) }));
  },

  async savePersona(p) {
    const next = { ...p, updatedAt: Date.now() };
    await rpdb.personas.put(next);
    set((s) => ({ personas: [...s.personas.filter((x) => x.id !== p.id), next].sort(byName) }));
  },

  async deletePersona(id) {
    await rpdb.personas.delete(id);
    set((s) => ({ personas: s.personas.filter((x) => x.id !== id) }));
  },
}));

export const blankCharacter = (): Character => {
  const t = Date.now();
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    exampleDialogue: '',
    systemPrompt: '',
    creatorNotes: '',
    tags: [],
    createdAt: t,
    updatedAt: t,
  };
};

export const blankPersona = (): Persona => {
  const t = Date.now();
  return { id: crypto.randomUUID(), name: '', description: '', createdAt: t, updatedAt: t };
};
