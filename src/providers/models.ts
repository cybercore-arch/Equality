import type { ModelInfo, ProviderConfig } from '../types';
import { throwHttpError } from './sse';

import { metaOf } from './catalog';

// Модели не для текстового чата: распознавание речи, озвучка, картинки, эмбеддинги, фильтры безопасности
const NOT_CHAT = /whisper|tts|speech|transcri|embed|moderation|guard|imagen|veo|\baqa\b|dall-e|image|audio|realtime|live/i;

/**
 * Запрашивает у провайдера актуальный список моделей, чтобы не угадывать названия вручную.
 * Если провайдер сообщает размер контекста модели, он тоже возвращается.
 */
export async function listModels(cfg: ProviderConfig): Promise<ModelInfo[]> {
  const base = (cfg.baseUrl || metaOf(cfg.id).base).replace(/\/+$/, '');
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
      .filter((m) => !NOT_CHAT.test(m.id))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  const headers: Record<string, string> = {};
  if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(`${base}/models`, { headers });
  if (!res.ok) await throwHttpError(res);
  const json = await res.json();
  const items: { id: string; context_length?: number; context_window?: number; architecture?: { output_modalities?: string[] } }[] =
    json.data ?? [];
  return (
    items
      // OpenRouter сообщает, что модель выдаёт на выходе; у остальных отсеиваем по названию
      .filter((m) => (m.architecture?.output_modalities ? m.architecture.output_modalities.includes('text') : !NOT_CHAT.test(m.id)))
      .map((m) => ({ id: m.id, context: m.context_length ?? m.context_window }))
      // Бесплатные модели OpenRouter (:free) показываем первыми
      .sort((a, b) => Number(b.id.endsWith(':free')) - Number(a.id.endsWith(':free')) || a.id.localeCompare(b.id))
  );
}
