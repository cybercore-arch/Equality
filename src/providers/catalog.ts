import type { ProviderKind } from '../types';

export interface ProviderMeta {
  id: ProviderKind;
  label: string;
  /** Короткая подпись на карточке выбора */
  hint: string;
  /** Адрес API (для OpenAI-совместимых); у Gemini свой протокол */
  base: string;
  defaultModel: string;
  /** Страница, где берётся ключ */
  keyUrl?: string;
  /** Показывать сразу на первом экране; остальные прячутся под «Другие» */
  featured: boolean;
  /** Просить у провайдера точное число токенов в конце потока (не все сервисы понимают этот параметр) */
  streamUsage: boolean;
}

export const CATALOG: ProviderMeta[] = [
  { id: 'openrouter', label: 'OpenRouter', hint: 'рекомендуем: много бесплатных моделей', base: 'https://openrouter.ai/api/v1', defaultModel: 'meta-llama/llama-3.3-70b-instruct:free', keyUrl: 'https://openrouter.ai/keys', featured: true, streamUsage: true },
  { id: 'gemini', label: 'Gemini', hint: 'бесплатно, из некоторых стран нужен VPN', base: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3.8-flash', keyUrl: 'https://aistudio.google.com/apikey', featured: true, streamUsage: false },
  { id: 'groq', label: 'Groq', hint: 'очень быстро', base: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', featured: true, streamUsage: true },
  { id: 'deepseek', label: 'DeepSeek', hint: 'сильные модели, платный API', base: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', featured: false, streamUsage: true },
  { id: 'mistral', label: 'Mistral', hint: 'европейский сервис', base: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', featured: false, streamUsage: false },
  { id: 'openai', label: 'OpenAI', hint: 'ChatGPT-модели, платный API', base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', featured: false, streamUsage: true },
  { id: 'xai', label: 'xAI', hint: 'модели Grok', base: 'https://api.x.ai/v1', defaultModel: 'grok-3-mini', keyUrl: 'https://console.x.ai', featured: false, streamUsage: true },
  { id: 'cerebras', label: 'Cerebras', hint: 'очень быстрые открытые модели', base: 'https://api.cerebras.ai/v1', defaultModel: 'llama-3.3-70b', keyUrl: 'https://cloud.cerebras.ai', featured: false, streamUsage: false },
  { id: 'together', label: 'Together', hint: 'много открытых моделей', base: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyUrl: 'https://api.together.xyz/settings/api-keys', featured: false, streamUsage: false },
  { id: 'nvidia', label: 'NVIDIA', hint: 'открытые модели NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com', featured: false, streamUsage: false },
  { id: 'custom', label: 'Свой', hint: 'любой OpenAI-совместимый, в том числе свой сервер', base: '', defaultModel: '', featured: false, streamUsage: false },
];

export const metaOf = (id: ProviderKind) => CATALOG.find((m) => m.id === id)!;
