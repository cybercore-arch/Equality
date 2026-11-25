/**
 * Приблизительная оценка числа токенов по длине текста (для русского и английского вперемешку).
 * Точное число считает только провайдер и присылает его вместе с ответом.
 */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 3.2);

/** 1 000 000 -> «1M», 128 000 -> «128K» */
export function formatContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  return `${Math.round(n / 1000)}K`;
}
