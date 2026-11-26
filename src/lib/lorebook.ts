import type { LoreEntry, Lorebook } from '../types';

const LORE_BUDGET = 6000; // символов лорбука в одном запросе
const SCAN_MESSAGES = 6; // сколько последних сообщений просматриваем на ключевые слова

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];

function keyMatches(key: string, text: string): boolean {
  const re = /^\/(.+)\/([a-z]*)$/.exec(key);
  if (re) {
    try {
      return new RegExp(re[1], re[2].includes('i') ? re[2] : re[2] + 'i').test(text);
    } catch {
      return false;
    }
  }
  return text.toLowerCase().includes(key.toLowerCase());
}

/** Какие записи сработали на недавнюю переписку. Самые важные идут первыми, общий объём ограничен. */
export function activeEntries(books: Lorebook[], recentTexts: string[]): LoreEntry[] {
  const text = recentTexts.slice(-SCAN_MESSAGES).join('\n');
  const hits = books
    .flatMap((b) => b.entries)
    .filter((e) => e.enabled && e.content.trim() && (e.constant || e.keys.some((k) => keyMatches(k, text))))
    .sort((a, b) => b.order - a.order);
  const out: LoreEntry[] = [];
  let used = 0;
  for (const e of hits) {
    if (used + e.content.length > LORE_BUDGET && out.length) continue;
    out.push(e);
    used += e.content.length;
  }
  return out;
}

/** Лорбук из JSON: формат SillyTavern World Info или character_book из карточки V2. */
export function lorebookFromJson(json: unknown, fallbackName = 'Лорбук'): Omit<Lorebook, 'id' | 'createdAt' | 'updatedAt'> {
  const root = (json ?? {}) as Record<string, unknown>;
  const book = (root.data && typeof root.data === 'object' && (root.data as Record<string, unknown>).entries ? root.data : root) as Record<string, unknown>;
  const raw = book.entries;
  const list: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  if (!list.length) throw new Error('В файле не нашлось записей лорбука');
  const entries: LoreEntry[] = list.map((e, i) => ({
    id: crypto.randomUUID(),
    name: str(e.name) || str(e.comment) || `Запись ${i + 1}`,
    keys: strs(e.keys ?? e.key),
    content: str(e.content),
    enabled: typeof e.enabled === 'boolean' ? e.enabled : !e.disable,
    constant: !!e.constant,
    order: Number(e.insertion_order ?? e.order ?? 100) || 100,
  }));
  return { name: str(book.name) || fallbackName, entries };
}

/** Лорбук в формате character_book (V2): его понимают SillyTavern и Chub. */
export function lorebookToJson(b: Lorebook) {
  return {
    name: b.name,
    description: '',
    scan_depth: SCAN_MESSAGES,
    token_budget: 2000,
    recursive_scanning: false,
    extensions: {},
    entries: b.entries.map((e, i) => ({
      id: i,
      keys: e.keys,
      secondary_keys: [],
      comment: e.name,
      name: e.name,
      content: e.content,
      constant: e.constant,
      selective: false,
      insertion_order: e.order,
      enabled: e.enabled,
      position: 'before_char',
      extensions: {},
    })),
  };
}
