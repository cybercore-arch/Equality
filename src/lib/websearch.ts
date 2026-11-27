import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useNet } from './net';

/**
 * «Костыль-поиск»: приложение само ищет в интернете через сторонний сервис (со своим ключом пользователя)
 * и добавляет найденное в запрос, чтобы поиск был у любой модели.
 * Запрос к поиску уходит только когда поиск включён в чате.
 */
export type SearchProviderId = 'tavily' | 'serper';

export interface SearchProviderMeta {
  id: SearchProviderId;
  label: string;
  hint: string;
  host: string;
  keyUrl: string;
}

export const SEARCH_PROVIDERS: SearchProviderMeta[] = [
  { id: 'tavily', label: 'Tavily', hint: 'сделан для ИИ, есть бесплатный лимит в месяц', host: 'api.tavily.com', keyUrl: 'https://app.tavily.com' },
  { id: 'serper', label: 'Serper', hint: 'результаты Google, есть бесплатные запросы при регистрации', host: 'google.serper.dev', keyUrl: 'https://serper.dev' },
];

export const SEARCH_HOSTS = SEARCH_PROVIDERS.map((p) => p.host);

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<{ status: number; data: unknown }> {
  const host = new URL(url).host;
  useNet.getState().record(host, false);
  // На телефоне идём через системный HTTP: у сайтов поиска может не быть разрешения для браузерных запросов (CORS)
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.request({ url, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, data: body, responseType: 'json', connectTimeout: 15000, readTimeout: 20000 });
    return { status: r.status, data: r.data };
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

function fail(status: number, label: string): never {
  if (status === 401 || status === 403) throw new Error(`${label}: ключ не подошёл. Проверь его в настройках поиска.`);
  if (status === 429 || status === 432 || status === 433) throw new Error(`${label}: лимит запросов исчерпан.`);
  throw new Error(`${label}: ошибка ${status}.`);
}

const asStr = (x: unknown) => (typeof x === 'string' ? x : '');
const arr = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);

export async function webSearch(provider: SearchProviderId, key: string, query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  if (provider === 'tavily') {
    const { status, data } = await postJson('https://api.tavily.com/search', { Authorization: `Bearer ${key}` }, { query, max_results: 5, search_depth: 'basic', topic: 'general' }, signal);
    if (status !== 200) fail(status, 'Tavily');
    return arr((data as Record<string, unknown>)?.results).map((r) => ({ title: asStr(r.title), url: asStr(r.url), snippet: asStr(r.content) }));
  }
  const { status, data } = await postJson('https://google.serper.dev/search', { 'X-API-KEY': key }, { q: query, num: 5 }, signal);
  if (status !== 200) fail(status, 'Serper');
  const d = data as Record<string, unknown>;
  const out = arr(d?.organic).map((r) => ({ title: asStr(r.title), url: asStr(r.link), snippet: asStr(r.snippet) }));
  const box = d?.answerBox as Record<string, unknown> | undefined;
  const direct = asStr(box?.answer) || asStr(box?.snippet);
  if (direct) out.unshift({ title: asStr(box?.title) || 'Быстрый ответ', url: asStr(box?.link), snippet: direct });
  return out;
}

/** Текст для запроса к модели: найденное с адресами, чтобы она могла назвать источники. */
export function formatHits(query: string, hits: SearchHit[]): string {
  if (!hits.length) return '';
  const list = hits.map((h, i) => `${i + 1}. ${h.title}${h.url ? ` (${h.url})` : ''}\n${h.snippet.slice(0, 600)}`).join('\n\n');
  return `[Результаты поиска в интернете по запросу «${query}». Опирайся на них, если они по теме. Если используешь факт из результатов, назови источник. Если результаты не по теме, не упоминай их.]\n${list}`;
}
