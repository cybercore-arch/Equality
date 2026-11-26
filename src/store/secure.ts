import { Capacitor } from '@capacitor/core';

/**
 * Защищённое хранилище ключей. В Android-приложении ключи лежат в Android Keystore (шифруются
 * ключом, который нельзя вытащить из телефона), а не открытым текстом в localStorage.
 * В браузере и на ПК пока обычное хранилище (для ПК позже будет системная связка ключей).
 */
export const isNative = Capacitor.isNativePlatform();

async function plugin() {
  return (await import('capacitor-secure-storage-plugin')).SecureStoragePlugin;
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    const r = await (await plugin()).get({ key });
    return r.value || null;
  } catch {
    return null; // ключа нет
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  const p = await plugin();
  if (value) await p.set({ key, value });
  else await p.remove({ key }).catch(() => undefined);
}

/** Проверяет, что хранилище реально работает: записываем и читаем пробное значение. */
export async function secureWorks(): Promise<{ ok: boolean; error?: string }> {
  if (!isNative) return { ok: false };
  try {
    await secureSet('probe', 'ok');
    const ok = (await secureGet('probe')) === 'ok';
    return ok ? { ok } : { ok, error: 'пробное значение не прочиталось' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
