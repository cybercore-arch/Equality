import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderConfig, ProviderKind } from '../types';

/**
 * ВАЖНО: на Этапе 1 ключи лежат в localStorage (открытым текстом).
 * На Этапе 4 заменим на Android Keystore / системное хранилище ПК.
 * Названия моделей меняются у провайдеров — их можно править прямо в настройках.
 */
const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: 'gemini', name: 'Google Gemini', apiKey: '', model: 'gemini-2.5-flash' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKey: '',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  { id: 'groq', name: 'Groq', apiKey: '', model: 'llama-3.3-70b-versatile' },
  { id: 'custom', name: 'Свой (OpenAI-совместимый)', apiKey: '', model: '', baseUrl: '' },
];

interface SettingsState {
  providers: ProviderConfig[];
  activeProvider: ProviderKind;
  modeId: string;
  /** Прошёл ли пользователь экран первого запуска */
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  updateProvider: (id: ProviderKind, patch: Partial<ProviderConfig>) => void;
  setActiveProvider: (id: ProviderKind) => void;
  setMode: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      providers: DEFAULT_PROVIDERS,
      activeProvider: 'gemini',
      modeId: 'general',
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),
      updateProvider: (id, patch) =>
        set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      setActiveProvider: (id) => set({ activeProvider: id }),
      setMode: (id) => set({ modeId: id }),
    }),
    { name: 'settings-v1' },
  ),
);
