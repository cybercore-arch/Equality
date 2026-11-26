import type { Character, Lorebook } from '../types';
import { lorebookToJson } from './lorebook';

/**
 * Импорт и экспорт карточек персонажей в формате Character Card V2 (SillyTavern, Chub и др.).
 * Карточка — это JSON, либо PNG-картинка, внутри которой JSON спрятан в текстовом блоке "chara" (base64).
 */

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Данные карточки из JSON (V1 и V2). Идентификатор и даты проставляет вызывающий. */
export function cardFromJson(json: unknown): Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'avatar'> {
  const root = (json ?? {}) as Record<string, unknown>;
  const d = (typeof root.spec === 'string' && root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const name = str(d.name).trim();
  if (!name && !str(d.description) && !str(d.first_mes)) throw new Error('Это не похоже на карточку персонажа');
  return {
    name: name || 'Без имени',
    description: str(d.description),
    personality: str(d.personality),
    scenario: str(d.scenario),
    firstMessage: str(d.first_mes),
    alternateGreetings: strs(d.alternate_greetings),
    exampleDialogue: str(d.mes_example),
    systemPrompt: str(d.system_prompt),
    creatorNotes: str(d.creator_notes),
    tags: strs(d.tags),
    book: d.character_book ?? undefined,
  };
}

export function cardToJson(c: Character, book?: Lorebook) {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: c.name,
      description: c.description,
      personality: c.personality,
      scenario: c.scenario,
      first_mes: c.firstMessage,
      mes_example: c.exampleDialogue,
      creator_notes: c.creatorNotes,
      system_prompt: c.systemPrompt,
      post_history_instructions: '',
      alternate_greetings: c.alternateGreetings,
      character_book: book ? lorebookToJson(book) : c.book ?? undefined,
      tags: c.tags,
      creator: '',
      character_version: '1',
      extensions: {},
    },
  };
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function b64ToText(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

/** Достаёт JSON карточки из текстового блока PNG. */
export function readPngCard(buf: ArrayBuffer): unknown {
  const bytes = new Uint8Array(buf);
  if (PNG_SIG.some((b, i) => bytes[i] !== b)) throw new Error('Это не PNG-файл');
  const view = new DataView(buf);
  let pos = 8;
  const latin = new TextDecoder('latin1');
  let found: string | null = null;
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = latin.decode(bytes.subarray(pos + 4, pos + 8));
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'tEXt' || type === 'iTXt') {
      const zero = data.indexOf(0);
      const key = latin.decode(data.subarray(0, zero));
      if (key === 'chara' || key === 'ccv3') {
        let text: string;
        if (type === 'tEXt') text = latin.decode(data.subarray(zero + 1));
        else {
          // iTXt: ключ\0 флаг сжатия, метод, язык\0 перевод\0 текст
          let p = zero + 3;
          p = data.indexOf(0, p) + 1;
          p = data.indexOf(0, p) + 1;
          text = new TextDecoder().decode(data.subarray(p));
        }
        found = text;
        if (key === 'ccv3') break; // V3 новее, предпочитаем его
      }
    }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!found) throw new Error('В этой картинке нет данных карточки персонажа');
  return JSON.parse(b64ToText(found));
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of data) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Вшивает JSON карточки в PNG (блок tEXt "chara" перед IEND). */
export function embedPngCard(png: Uint8Array, json: unknown): Uint8Array {
  const raw = new TextEncoder().encode(JSON.stringify(json));
  let bin = '';
  for (let i = 0; i < raw.length; i += 8192) bin += String.fromCharCode(...raw.subarray(i, i + 8192));
  const payload = btoa(bin);
  const body = new Uint8Array([...new TextEncoder().encode('chara'), 0, ...new TextEncoder().encode(payload)]);
  const type = new TextEncoder().encode('tEXt');
  const chunk = new Uint8Array(12 + body.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, body.length);
  chunk.set(type, 4);
  chunk.set(body, 8);
  dv.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
  const iend = png.length - 12; // IEND всегда последний: 4 длина + 4 тип + 0 данных + 4 crc
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(png.subarray(iend), iend + chunk.length);
  return out;
}

/** Квадратный аватар из картинки: обрезка по центру, JPEG, чтобы база не раздувалась. */
export async function makeAvatar(blob: Blob, size = 384): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(size, side);
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Файл → карточка (без id). Принимает JSON и PNG. */
export async function importCardFile(file: File) {
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  if (isPng) {
    const card = cardFromJson(readPngCard(await file.arrayBuffer()));
    return { ...card, avatar: await makeAvatar(file) };
  }
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error(`${file.name}: не удалось прочитать файл. Нужен JSON или PNG с карточкой.`);
  }
  return cardFromJson(json);
}

async function avatarPng(c: Character): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  if (c.avatar) {
    const img = await createImageBitmap(await (await fetch(c.avatar)).blob());
    ctx.drawImage(img, 0, 0, 512, 512);
  } else {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#fafafa';
    ctx.font = '600 240px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((c.name[0] ?? '?').toUpperCase(), 256, 280);
  }
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export const exportJson = (c: Character, book?: Lorebook) => new Blob([JSON.stringify(cardToJson(c, book), null, 2)], { type: 'application/json' });
export const exportPng = async (c: Character, book?: Lorebook) => new Blob([embedPngCard(await avatarPng(c), cardToJson(c, book)) as BlobPart], { type: 'image/png' });
