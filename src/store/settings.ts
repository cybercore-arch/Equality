import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATALOG } from '../providers/catalog';
import type { ProviderConfig, ProviderKind } from '../types';
import { secureGet, secureSet, secureWorks } from './secure';

/**
 * ВАЖНО: на Этапе 1 ключи лежат в localStorage (открытым текстом).
 * На Этапе 4 заменим на Android Keystore / системное хранилище ПК.
 * Названия моделей меняются у провайдеров — их можно править прямо в настройках.
 */
const DEFAULT_PROVIDERS: ProviderConfig[] = CATALOG.map((m) => ({
  id: m.id,
  name: m.id === 'custom' ? 'Свой (OpenAI-совместимый)' : m.label,
  apiKey: '',
  model: m.defaultModel,
  ...(m.id === 'custom' ? { baseUrl: '' } : {}),
}));

/** Ключи, уже перенесённые в защищённое хранилище: сравниваем с ними, чтобы писать только изменения */
let savedKeys: Record<string, string> = {};
/** true, когда защищённое хранилище проверено и работает: тогда ключи не пишем в localStorage */
let secureOk = false;

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
  /** Автоматически сжимать старую часть переписки, когда контекст почти заполнен */
  autoSummary: boolean;
  setAutoSummary: (v: boolean) => void;
  setDefaultPersona: (id: string | null) => void;
  updateProvider: (id: ProviderKind, patch: Partial<ProviderConfig>) => void;
  setActiveProvider: (id: ProviderKind) => void;
  setMode: (id: string) => void;
  /** Ключи загружены из защищённого хранилища (до этого интерфейс не показываем) */
  keysReady: boolean;
  initKeys: () => Promise<void>;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      keysReady: false,
      async initKeys() {
        if (!(await secureWorks())) {
          set({ keysReady: true });
          return;
        }
        // Достаём ключи из хранилища; ключи, которые ещё лежат открытым текстом (старые версии), переносим туда
        const next = await Promise.all(
          get().providers.map(async (p) => {
            const stored = await secureGet(`apikey:${p.id}`);
            if (stored) return { ...p, apiKey: stored };
            if (p.apiKey) await secureSet(`apikey:${p.id}`, p.apiKey);
            return p;
          }),
        );
        savedKeys = Object.fromEntries(next.map((p) => [p.id, p.apiKey]));
        secureOk = true;
        set({ providers: next, keysReady: true }); // заодно перезаписывает localStorage уже без ключей
        useSettings.subscribe((st) => {
          for (const p of st.providers) {
            if (savedKeys[p.id] !== p.apiKey) {
              savedKeys[p.id] = p.apiKey;
              void secureSet(`apikey:${p.id}`, p.apiKey);
            }
          }
        });
      },
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
      autoSummary: true,
      setAutoSummary: (v) => set({ autoSummary: v }),
      setDefaultPersona: (id) => set({ defaultPersonaId: id }),
      updateProvider: (id, patch) =>
        set((s) => ({ providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      setActiveProvider: (id) => set({ activeProvider: id }),
      setMode: (id) => set({ modeId: id }),
    }),
    {
      name: 'settings-v1',
      version: 2,
      // В localStorage ключи не пишем, если работает защищённое хранилище; служебные поля тоже не сохраняем
      partialize: (st) => {
        const { keysReady: _k, initKeys: _i, ...rest } = st;
        void _k;
        void _i;
        return secureOk ? { ...rest, providers: st.providers.map((p) => ({ ...p, apiKey: '' })) } : rest;
      },
      // Новые провайдеры из каталога добавляются к уже сохранённым настройкам
      merge: (persisted, current) => {
        const saved = (persisted as Partial<SettingsState> | undefined) ?? {};
        const providers = DEFAULT_PROVIDERS.map((d) => ({ ...d, ...saved.providers?.find((p) => p.id === d.id) }));
        return { ...current, ...saved, providers };
      },
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
