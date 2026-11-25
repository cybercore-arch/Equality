import type { ProviderConfig, StreamParams } from '../types';
import { streamGemini } from './gemini';
import { streamOpenAICompat } from './openaiCompat';

/** Единая точка входа: выбирает реализацию по типу провайдера. */
export function streamChat(cfg: ProviderConfig, p: StreamParams): AsyncGenerator<string> {
  return cfg.id === 'gemini' ? streamGemini(cfg, p) : streamOpenAICompat(cfg, p);
}
