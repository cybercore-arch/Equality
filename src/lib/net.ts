import { create } from 'zustand';
import { CATALOG } from '../providers/catalog';
import { useSettings } from '../store/settings';

/**
 * Сетевой журнал и «охрана»: приложение может обращаться только к адресам известных провайдеров
 * и к адресу, который пользователь сам указал для своего сервера. Всё остальное блокируется и попадает в журнал.
 * Так пользователь видит, куда уходят данные, и никакой посторонний код не смог бы отправить ключи или сообщения «на сторону».
 */
interface HostStat {
  count: number;
  blocked: number;
  last: number;
}

interface NetState {
  hosts: Record<string, HostStat>;
  record: (host: string, blocked: boolean) => void;
  reset: () => void;
}

const KEY = 'net-log-v1';
const load = (): Record<string, HostStat> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};

export const useNet = create<NetState>((set, get) => ({
  hosts: load(),
  record(host, blocked) {
    const cur = get().hosts[host] ?? { count: 0, blocked: 0, last: 0 };
    const hosts = { ...get().hosts, [host]: { count: cur.count + (blocked ? 0 : 1), blocked: cur.blocked + (blocked ? 1 : 0), last: Date.now() } };
    set({ hosts });
    try {
      localStorage.setItem(KEY, JSON.stringify(hosts));
    } catch {
      /* журнал необязателен */
    }
  },
  reset() {
    set({ hosts: {} });
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
}));

const hostOf = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
};

/** Разрешённые адреса: все провайдеры из каталога и свой сервер из настроек. */
export function allowedHosts(): Set<string> {
  const hosts = new Set(CATALOG.map((m) => hostOf(m.base)).filter(Boolean));
  for (const p of useSettings.getState().providers) {
    if (p.baseUrl) {
      const h = hostOf(p.baseUrl);
      if (h) hosts.add(h);
    }
  }
  return hosts;
}

export function installNetGuard() {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Файлы самого приложения, data: и blob: никуда не уходят
    if (!/^https?:/i.test(url) || hostOf(url) === location.host) return original(input, init);
    const host = hostOf(url);
    if (!allowedHosts().has(host)) {
      useNet.getState().record(host || url.slice(0, 40), true);
      return Promise.reject(new TypeError(`Equality заблокировал запрос к «${host}»: этого адреса нет среди провайдеров и твоих серверов.`));
    }
    useNet.getState().record(host, false);
    return original(input, init);
  };
}
