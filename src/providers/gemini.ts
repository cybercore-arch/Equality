import type { ProviderConfig, StreamParams } from '../types';
import { readSSE, throwHttpError } from './sse';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function* streamGemini(cfg: ProviderConfig, p: StreamParams): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    contents: p.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } })),
        ...(m.content || !m.images?.length ? [{ text: m.content }] : []),
      ],
    })),
    generationConfig: {
      temperature: p.temperature,
      topP: p.topP,
      ...(p.maxTokens ? { maxOutputTokens: p.maxTokens } : {}),
    },
  };
  if (p.system) body.systemInstruction = { parts: [{ text: p.system }] };
  if (p.googleSearch) body.tools = [{ google_search: {} }];

  const res = await fetch(`${BASE}/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    signal: p.signal,
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwHttpError(res);

  for await (const data of readSSE(res)) {
    try {
      const json = JSON.parse(data);
      const usage = json.usageMetadata;
      if (usage) p.onUsage?.({ completion: usage.candidatesTokenCount, prompt: usage.promptTokenCount });
      const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) if (part.text) yield part.text;
    } catch {
      /* пропускаем неполные фрагменты */
    }
  }
}
