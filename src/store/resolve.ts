import type { Chat, ProviderConfig, ProviderKind } from '../types';

/**
 * Какой провайдер и модель использует чат: свои, если заданы в чате, иначе настройки по умолчанию.
 */
export function resolveProvider(
  chat: Chat,
  s: { providers: ProviderConfig[]; activeProvider: ProviderKind },
): ProviderConfig {
  const base = s.providers.find((p) => p.id === (chat.providerId ?? s.activeProvider)) ?? s.providers[0];
  return { ...base, model: chat.model?.trim() ? chat.model : base.model };
}
