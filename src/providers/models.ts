import type { ProviderConfig } from '../types';
import { throwHttpError } from './sse';

const DEFAULT_BASE: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

/** Запрашивает у провайдера актуальный список моделей, чтобы не угадывать названия вручную. */
export async function listModels(cfg: ProviderConfig): Promise<string[]> {
  const base = (cfg.baseUrl || DEFAULT_BASE[cfg.id] || '').replace(/\/+$/, '');
  if (!base) throw new Error('Сначала укажи Base URL');
  if (cfg.id !== 'custom' && !cfg.apiKey.trim()) throw new Error('Сначала вставь API-ключ');

  if (cfg.id === 'gemini') {
    const res = await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': cfg.apiKey } });
    if (!res.ok) await throwHttpError(res);
    const json = await res.json();
    const models: { name: string; supportedGenerationMethods?: string[] }[] = json.models ?? [];
    return models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .sort();
  }

  const headers: Record<string, string> = {};
  if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) await throwHttpError(res);
  const json = await res.json();
  const ids: string[] = (json.data ?? []).map((m: { id: string }) => m.id);
  // Бесплатные модели OpenRouter (:free) показываем первыми
  return ids.sort((a, b) => Number(b.endsWith(':free')) - Number(a.endsWith(':free')) || a.localeCompare(b));
}
