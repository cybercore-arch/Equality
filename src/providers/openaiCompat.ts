import type { ProviderConfig, StreamParams } from '../types';
import { readSSE, throwHttpError } from './sse';

const DEFAULT_BASE: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
};

/** OpenRouter, Groq и любой OpenAI-совместимый эндпоинт. */
export async function* streamOpenAICompat(
  cfg: ProviderConfig,
  p: StreamParams,
): AsyncGenerator<string> {
  const base = (cfg.baseUrl || DEFAULT_BASE[cfg.id] || '').replace(/\/+$/, '');
  if (!base) throw new Error('Не указан Base URL');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.id === 'openrouter') headers['X-Title'] = 'Equality';

  const messages = [
    ...(p.system ? [{ role: 'system', content: p.system }] : []),
    ...p.messages,
  ];

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    signal: p.signal,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      temperature: p.temperature,
      top_p: p.topP,
      // Просим провайдера прислать точное число токенов в конце потока (свои серверы не трогаем)
      ...(cfg.id !== 'custom' ? { stream_options: { include_usage: true } } : {}),
    }),
  });
  if (!res.ok) await throwHttpError(res);

  for await (const data of readSSE(res)) {
    if (data === '[DONE]') return;
    try {
      const json = JSON.parse(data);
      if (json.error) throw new Error(json.error.message ?? 'Ошибка провайдера');
      if (json.usage) p.onUsage?.({ completion: json.usage.completion_tokens, prompt: json.usage.prompt_tokens });
      const delta: string | undefined = json.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    } catch (e) {
      if (e instanceof SyntaxError) continue; // неполный/служебный фрагмент
      throw e;
    }
  }
}
