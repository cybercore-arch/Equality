import type { ModelInfo, ProviderConfig } from '../types';
import { throwHttpError } from './sse';

const DEFAULT_BASE: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

/**
 * Запрашивает у провайдера актуальный список моделей, чтобы не угадывать названия вручную.
 * Если провайдер сообщает размер контекста модели, он тоже возвращается.
 */
export async function listModels(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const base = (cfg.baseUrl || DEFAULT_BASE[cfg.id] || '').replace(/\/+$/, '');
  if (!base) throw new Error('Сначала укажи Base URL');
  if (cfg.id !== 'custom' && !cfg.apiKey.trim()) throw new Error('Сначала вставь API-ключ');

  if (cfg.id === 'gemini') {
    const res = await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': cfg.apiKey } });
    if (!res.ok) await throwHttpError(res);
    const json = await res.json();
    const models: { name: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[] =
      json.models ?? [];
    return models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), context: m.inputTokenLimit }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  const headers: Record<string, string> = {};
  if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) await throwHttpError(res);
  const json = await res.json();
  const items: { id: string; context_length?: number; context_window?: number }[] = json.data ?? [];
  return (
    items
      .map((m) => ({ id: m.id, context: m.context_length ?? m.context_window }))
      // Бесплатные модели OpenRouter (:free) показываем первыми
      .sort((a, b) => Number(b.id.endsWith(':free')) - Number(a.id.endsWith(':free')) || a.id.localeCompare(b.id))
  );
}
