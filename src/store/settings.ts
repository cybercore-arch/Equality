import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderConfig, ProviderKind } from '../types';

/**
 * ВАЖНО: на Этапе 1 ключи лежат в localStorage (открытым текстом).
 * На Этапе 4 заменим на Android Keystore / системное хранилище ПК.
 * Названия моделей меняются у провайдеров — их можно править прямо в настройках.
 */
const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: 'gemini', name: 'Google Gemini', apiKey: '', model: 'gemini-3.8-flash' },
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
  /** Поиск Google для Gemini. По умолчанию выключен: на бесплатных ключах он часто недоступен */
  searchEnabled: boolean;
  setSearchEnabled: (v: boolean) => void;
  /** Общий системный промпт: добавляется во все чаты всех режимов */
  globalPrompt: string;
  setGlobalPrompt: (v: string) => void;
  /** Персона игрока по умолчанию для ролплея */
  defaultPersonaId: string | null;
  setDefaultPersona: (id: string | null) => void;
  updateProvider: (id: ProviderKind, patch: Partial<ProviderConfig>) => void;
  setActiveProvider: (id: ProviderKind) => void;
  setMode: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      providers: DEFAULT_PROVIDERS,
      activeProvider: 'openrouter',
      modeId: 'general',
      onboarded: false,
      setOnboarded: (v) => set({ onboarded: v }),
      searchEnabled: false,
      setSearchEnabled: (v) => set({ searchEnabled: v }),
      globalPrompt: '',
      setGlobalPrompt: (v) => set({ globalPrompt: v }),
      defaultPersonaId: null,
      setDefaultPersona: (id) => set({ defaultPersonaId: id }),
      updateProvider: (id, patch) =>
        set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      setActiveProvider: (id) => set({ activeProvider: id }),
      setMode: (id) => set({ modeId: id }),
    }),
    {
      name: 'settings-v1',
      version: 2,
      // Версия 2: Google отключил gemini-2.5-flash, заменяем старое значение у тех, кто его не менял
      migrate: (persisted, version) => {
        const state = persisted as { providers?: ProviderConfig[] };
        if (version < 2 && state.providers) {
          state.providers = state.providers.map((p) =>
            p.id === 'gemini' && p.model === 'gemini-2.5-flash' ? { ...p, model: 'gemini-3.8-flash' } : p,
          );
        }
        return state as SettingsState;
      },
    },
  ),
);
