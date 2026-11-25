import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../db/db';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeValues {
  /** Тёмная, светлая или как в системе */
  mode: ThemeMode;
  /** Цвет акцента (hex) или 'auto' (белый в тёмной теме, чёрный в светлой) */
  accent: string;
  /** Прозрачность пузырей сообщений, 0.15–1 */
  bubbleAlpha: number;
  /** Прозрачность панелей (шапка, поле ввода, меню), 0.15–1 */
  panelAlpha: number;
  /** Размытие "стекла" за панелями и пузырями, px */
  blur: number;
  /** Скругление пузырей, px */
  radius: number;
  /** Размер текста, px */
  fontSize: number;
  /** Размытие картинки фона, px */
  bgBlur: number;
  /** Затемнение картинки фона, 0–0.9 */
  bgDim: number;
}

export const DEFAULT_THEME: ThemeValues = {
  mode: 'dark',
  accent: 'auto',
  bubbleAlpha: 1,
  panelAlpha: 0.85,
  blur: 16,
  radius: 18,
  fontSize: 15,
  bgBlur: 0,
  bgDim: 0.35,
};

interface ThemeState extends ThemeValues {
  /** Увеличивается при смене фона, чтобы компонент фона перезагрузил картинку */
  bgVersion: number;
  set: (patch: Partial<ThemeValues>) => void;
  /** Сбрасывает оформление, но оставляет выбранную тёмную/светлую тему */
  reset: () => void;
  setBackground: (file: File) => Promise<void>;
  clearBackground: () => Promise<void>;
}

/** Уменьшаем картинку до 1600px и сжимаем, чтобы фон не тормозил и не раздувал базу. */
async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать картинку'))), 'image/jpeg', 0.82),
  );
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME,
      bgVersion: 0,
      set: (patch) => set(patch),
      reset: () => set((s) => ({ ...DEFAULT_THEME, mode: s.mode })),
      async setBackground(file) {
        const blob = await compressImage(file);
        await db.kv.put({ key: 'background', value: blob });
        set((s) => ({ bgVersion: s.bgVersion + 1 }));
      },
      async clearBackground() {
        await db.kv.delete('background');
        set((s) => ({ bgVersion: s.bgVersion + 1 }));
      },
    }),
    {
      name: 'theme-v1',
      partialize: (s): ThemeValues => ({
        mode: s.mode,
        accent: s.accent,
        bubbleAlpha: s.bubbleAlpha,
        panelAlpha: s.panelAlpha,
        blur: s.blur,
        radius: s.radius,
        fontSize: s.fontSize,
        bgBlur: s.bgBlur,
        bgDim: s.bgDim,
      }),
    },
  ),
);

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function resolveMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

/** Записывает тему в CSS-переменные — весь интерфейс подхватывает их мгновенно. */
export function applyTheme(t: ThemeValues) {
  const mode = resolveMode(t.mode);
  const el = document.documentElement;
  el.dataset.theme = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'light' ? '#fafafa' : '#09090b');

  const accent = t.accent === 'auto' ? (mode === 'light' ? '#18181b' : '#f4f4f5') : t.accent;
  const [r, g, b] = hexToRgb(accent);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const root = el.style;
  root.setProperty('--accent-rgb', `${r} ${g} ${b}`);
  root.setProperty('--on-accent', lum > 0.55 ? '9 9 11' : '255 255 255');
  root.setProperty('--bubble-alpha', String(t.bubbleAlpha));
  root.setProperty('--panel-alpha', String(t.panelAlpha));
  root.setProperty('--blur', `${t.blur}px`);
  root.setProperty('--radius', `${t.radius}px`);
  root.setProperty('--fs', `${t.fontSize}px`);
}
