import type { ProviderKind } from '../types';

const VISION = /vision|llava|pixtral|gpt-4o|gpt-4\.1|gpt-5|\bo[134]\b|claude|gemini|gemma-?3|llama-?4|scout|maverick|qwen[\w.-]*vl|\bvl\b|-vl-|qvq|grok-(2-vision|4)|mistral-(small|medium)-3|internvl|molmo|glm-4\.\dv/i;

/** Умеет ли модель читать картинки. Точных данных нет почти ни у кого, поэтому судим по названию. */
export function supportsImages(provider: ProviderKind, model: string): boolean {
  if (provider === 'gemini') return !/embed|tts|gemma-?[12]\b/i.test(model);
  return VISION.test(model);
}
