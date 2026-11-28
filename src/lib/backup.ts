import type { Table } from 'dexie';
import { db } from '../db/db';
import { rpdb } from '../db/rpdb';
import { useSettings } from '../store/settings';
import { useTheme } from '../store/theme';
import { saveFile } from './saveFile';
import type { Chat, Character, Folder, Lorebook, Message, Persona, ProviderConfig } from '../types';

/** Формат файла резервной копии. Версию поднимаем, если структура изменится. */
const FORMAT = 'equality-backup';
const VERSION = 1;

interface BackupData {
  chats: Chat[];
  messages: Message[];
  folders: Folder[];
  kv: { key: string; type: string; b64: string }[];
  characters: Character[];
  personas: Persona[];
  lorebooks: Lorebook[];
  settings: Record<string, unknown>;
  theme: Record<string, unknown>;
}

interface PlainFile {
  format: typeof FORMAT;
  version: number;
  createdAt: number;
  encrypted: false;
  hasKeys: boolean;
  data: BackupData;
}

interface EncryptedFile {
  format: typeof FORMAT;
  version: number;
  createdAt: number;
  encrypted: true;
  hasKeys: boolean;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
}

export type BackupFile = PlainFile | EncryptedFile;

export interface BackupSummary {
  chats: number;
  messages: number;
  characters: number;
  personas: number;
  lorebooks: number;
  folders: number;
  hasKeys: boolean;
  createdAt: number;
}

const ITERATIONS = 250_000;

// ---------- base64 ----------

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function blobToB64(blob: Blob): Promise<string> {
  return bytesToB64(new Uint8Array(await blob.arrayBuffer()));
}

// ---------- шифрование ----------

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(plain: string, password: string): Promise<Pick<EncryptedFile, 'kdf' | 'iv' | 'ciphertext'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plain));
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: bytesToB64(salt) },
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(buf)),
  };
}

async function decrypt(file: EncryptedFile, password: string): Promise<string> {
  const key = await deriveKey(password, b64ToBytes(file.kdf.salt), file.kdf.iterations);
  try {
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(file.iv) as BufferSource }, key, b64ToBytes(file.ciphertext) as BufferSource);
    return new TextDecoder().decode(buf);
  } catch {
    throw new Error('Неверный пароль или файл повреждён');
  }
}

// ---------- сбор данных ----------

const SETTINGS_FIELDS = ['providers', 'activeProvider', 'searchProvider', 'searchKeys', 'modeId', 'customModes', 'onboarded', 'searchEnabled', 'globalPrompt', 'defaultPersonaId', 'autoSummary'] as const;
const THEME_FIELDS = ['mode', 'accent', 'bubbleAlpha', 'panelAlpha', 'blur', 'radius', 'fontSize', 'bgBlur', 'bgDim'] as const;

async function collect(includeKeys: boolean): Promise<BackupData> {
  const [chats, messages, folders, kvRows, characters, personas, lorebooks] = await Promise.all([
    db.chats.toArray(),
    db.messages.toArray(),
    db.folders.toArray(),
    db.kv.toArray(),
    rpdb.characters.toArray(),
    rpdb.personas.toArray(),
    rpdb.lorebooks.toArray(),
  ]);
  const kv = await Promise.all(kvRows.map(async (r) => ({ key: r.key, type: r.value.type, b64: await blobToB64(r.value) })));

  const st = useSettings.getState() as unknown as Record<string, unknown>;
  const settings: Record<string, unknown> = {};
  for (const f of SETTINGS_FIELDS) settings[f] = st[f];
  settings.providers = (st.providers as ProviderConfig[]).map((p) => ({ ...p, apiKey: includeKeys ? p.apiKey : '' }));

  const sk = (st.searchKeys as Record<string, string> | undefined) ?? {};
  settings.searchKeys = Object.fromEntries(Object.entries(sk).map(([k, v]) => [k, includeKeys ? v : '']));

  const th = useTheme.getState() as unknown as Record<string, unknown>;
  const theme: Record<string, unknown> = {};
  for (const f of THEME_FIELDS) theme[f] = th[f];

  return { chats, messages, folders, kv, characters, personas, lorebooks, settings, theme };
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Собирает копию и отдаёт файл. Ключи включаются только вместе с паролем (иначе они лежали бы в файле открытым текстом). */
export async function exportBackup(opts: { includeKeys: boolean; password: string }): Promise<void> {
  const includeKeys = opts.includeKeys && !!opts.password;
  const data = await collect(includeKeys);
  const base = { format: FORMAT, version: VERSION, createdAt: Date.now(), hasKeys: includeKeys } as const;
  let file: BackupFile;
  if (opts.password) {
    file = { ...base, encrypted: true, ...(await encrypt(JSON.stringify(data), opts.password)) };
  } else {
    file = { ...base, encrypted: false, data };
  }
  await saveFile(`equality-backup-${stamp()}.json`, new Blob([JSON.stringify(file)], { type: 'application/json' }));
}

// ---------- импорт ----------

export async function parseBackup(text: string): Promise<BackupFile> {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Это не файл резервной копии Equality');
  }
  const f = obj as Partial<BackupFile>;
  if (!f || f.format !== FORMAT) throw new Error('Это не файл резервной копии Equality');
  if (typeof f.version !== 'number' || f.version > VERSION) throw new Error('Файл создан в более новой версии приложения. Обновите Equality.');
  return f as BackupFile;
}

export async function openBackup(file: BackupFile, password: string): Promise<BackupData> {
  if (!file.encrypted) return file.data;
  if (!password) throw new Error('Введите пароль');
  return JSON.parse(await decrypt(file, password)) as BackupData;
}

export function summarize(file: BackupFile, data?: BackupData): BackupSummary {
  return {
    chats: data?.chats.length ?? 0,
    messages: data?.messages.length ?? 0,
    characters: data?.characters.length ?? 0,
    personas: data?.personas.length ?? 0,
    lorebooks: data?.lorebooks.length ?? 0,
    folders: data?.folders.length ?? 0,
    hasKeys: file.hasKeys,
    createdAt: file.createdAt,
  };
}

function validate(d: BackupData): BackupData {
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    chats: arr(d.chats),
    messages: arr(d.messages),
    folders: arr(d.folders),
    kv: arr(d.kv),
    characters: arr(d.characters),
    personas: arr(d.personas),
    lorebooks: arr(d.lorebooks),
    settings: (d.settings as Record<string, unknown>) ?? {},
    theme: (d.theme as Record<string, unknown>) ?? {},
  };
}

async function addMissing<T extends { id: string }>(table: Table<T, string>, rows: T[]) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const existing = await table.bulkGet(part.map((r) => r.id));
    await table.bulkAdd(part.filter((_, j) => !existing[j]));
  }
}

/**
 * merge: добавляет чаты, персонажей и т.д., которых ещё нет (по id); настройки и оформление не трогает.
 * replace: полностью заменяет данные и настройки.
 */
export async function applyBackup(raw: BackupData, mode: 'merge' | 'replace'): Promise<void> {
  const d = validate(raw);

  if (mode === 'replace') {
    await Promise.all([db.chats.clear(), db.messages.clear(), db.folders.clear(), db.kv.clear(), rpdb.characters.clear(), rpdb.personas.clear(), rpdb.lorebooks.clear()]);
    await db.chats.bulkAdd(d.chats);
    for (let i = 0; i < d.messages.length; i += 500) await db.messages.bulkAdd(d.messages.slice(i, i + 500));
    await db.folders.bulkAdd(d.folders);
    await db.kv.bulkAdd(d.kv.map((r) => ({ key: r.key, value: new Blob([b64ToBytes(r.b64) as BlobPart], { type: r.type }) })));
    await rpdb.characters.bulkAdd(d.characters);
    await rpdb.personas.bulkAdd(d.personas);
    await rpdb.lorebooks.bulkAdd(d.lorebooks);

    // Настройки: пустой ключ в копии не стирает ключ, который уже есть на этом устройстве
    const cur = useSettings.getState().providers;
    const incoming = (d.settings.providers as ProviderConfig[] | undefined) ?? [];
    const providers = cur.map((p) => {
      const b = incoming.find((x) => x.id === p.id);
      return b ? { ...p, ...b, apiKey: b.apiKey || p.apiKey } : p;
    });
    const patch: Record<string, unknown> = {};
    for (const f of SETTINGS_FIELDS) if (f in d.settings) patch[f] = d.settings[f];
    const curSk = useSettings.getState().searchKeys;
    const inSk = (d.settings.searchKeys as Record<string, string> | undefined) ?? {};
    const searchKeys = Object.fromEntries(Object.keys(curSk).map((k) => [k, inSk[k] || curSk[k as keyof typeof curSk]]));
    useSettings.setState({ ...patch, providers, searchKeys } as never);
    useTheme.setState({ ...d.theme, bgVersion: useTheme.getState().bgVersion + 1 } as never);
    // Даём подпискам время записать ключи в защищённое хранилище
    await new Promise((r) => setTimeout(r, 700));
    return;
  }

  // Ключи из копии подставляем только туда, где на этом устройстве ключ ещё не задан
  const incoming = (d.settings.providers as ProviderConfig[] | undefined) ?? [];
  if (incoming.some((b) => b.apiKey)) {
    useSettings.setState({
      providers: useSettings.getState().providers.map((p) => {
        const b = incoming.find((x) => x.id === p.id);
        return b?.apiKey && !p.apiKey ? { ...p, apiKey: b.apiKey, model: p.model || b.model } : p;
      }),
    });
    await new Promise((r) => setTimeout(r, 700));
  }

  const inSk2 = (d.settings.searchKeys as Record<string, string> | undefined) ?? {};
  const curSk2 = useSettings.getState().searchKeys;
  if (Object.values(inSk2).some(Boolean)) {
    useSettings.setState({ searchKeys: Object.fromEntries(Object.keys(curSk2).map((k) => [k, curSk2[k as keyof typeof curSk2] || inSk2[k] || ''])) as typeof curSk2 });
    await new Promise((r) => setTimeout(r, 700));
  }

  await addMissing(db.chats, d.chats);
  await addMissing(db.messages, d.messages);
  await addMissing(db.folders, d.folders);
  await addMissing(rpdb.characters, d.characters);
  await addMissing(rpdb.personas, d.personas);
  await addMissing(rpdb.lorebooks, d.lorebooks);
}

// ---------- экспорт одного чата ----------

/** Текст текущей ветки чата в Markdown. */
export function chatToMarkdown(opts: { title: string; messages: Message[]; userName: string; assistantName: string; strip: (t: string) => string }): string {
  const lines = [`# ${opts.title}`, ''];
  for (const m of opts.messages) {
    if (m.role === 'system') continue;
    const who = m.role === 'user' ? opts.userName : opts.assistantName;
    const text = opts.strip(m.content).trim();
    const files = (m.attachments ?? []).map((a) => `_[вложение: ${a.name}]_`).join(' ');
    lines.push(`**${who}:**`, '', [text, files].filter(Boolean).join('\n\n'), '');
  }
  return lines.join('\n');
}
