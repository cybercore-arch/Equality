import type { Attachment } from '../types';

const MAX_TEXT = 300_000; // символов в одном текстовом файле
const MAX_SIDE = 1600; // длинная сторона фото после уменьшения, px
const NOT_TEXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|apk|exe|mp3|mp4|wav|mov|avi|mkv|bin|db)$/i;

const uid = () => crypto.randomUUID();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Уменьшает фото и сжимает в JPEG: так запрос быстрее и база не раздувается. */
async function shrinkImage(file: File): Promise<{ data: string; mime: string }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // прозрачные PNG не должны становиться чёрными
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.85));
  return { data: await blobToBase64(blob), mime: 'image/jpeg' };
}

/** Читает файл: фото уменьшает, текст читает как есть. Бросает понятную ошибку, если файл не подходит. */
export async function readAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith('image/')) {
    try {
      const { data, mime } = await shrinkImage(file);
      return { id: uid(), name: file.name, mime, kind: 'image', size: file.size, data };
    } catch {
      throw new Error(`${file.name}: не удалось открыть фото`);
    }
  }
  if (NOT_TEXT.test(file.name) || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    throw new Error(`${file.name}: такие файлы пока не читаются. Работают текст, код, таблицы CSV и фото.`);
  }
  const text = await file.text();
  if (text.includes('\u0000')) throw new Error(`${file.name}: это не текстовый файл`);
  if (text.length > MAX_TEXT) {
    throw new Error(`${file.name}: слишком большой (${Math.round(text.length / 1000)}K символов, максимум ${MAX_TEXT / 1000}K)`);
  }
  return { id: uid(), name: file.name, mime: file.type || 'text/plain', kind: 'text', size: file.size, text };
}

export const dataUrl = (a: Attachment) => `data:${a.mime};base64,${a.data ?? ''}`;
