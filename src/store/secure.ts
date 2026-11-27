import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Защищённое хранилище ключей. В Android-приложении ключи лежат в Android Keystore (шифруются
 * ключом, который нельзя вытащить из телефона), а не открытым текстом в localStorage.
 * В браузере и на ПК пока обычное хранилище (для ПК позже будет системная связка ключей).
 */
export const isNative = Capacitor.isNativePlatform();

/** На каком шаге остановилась проверка (нужно, чтобы понять, где хранилище зависает) */
export let secureStage = '';

interface KeyVaultPlugin {
  get(o: { key: string }): Promise<{ value?: string }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

// Своё хранилище на Android Keystore (исходники: native/KeyVaultPlugin.java)
const KeyVault = registerPlugin<KeyVaultPlugin>('KeyVault');

// ВАЖНО: плагин Capacitor нельзя возвращать из async-функции или передавать в await:
// у него на любое свойство, включая `then`, находится «метод», и промис вечно ждёт ответа от Android.

export async function secureGet(key: string): Promise<string | null> {
  try {
    const r = await KeyVault.get({ key });
    return r.value || null;
  } catch {
    return null; // ключа нет
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (value) await KeyVault.set({ key, value });
  else await KeyVault.remove({ key }).catch(() => undefined);
}

/** Проверяет, что хранилище реально работает: записываем и читаем пробное значение. */
export async function secureWorks(): Promise<{ ok: boolean; error?: string }> {
  if (!isNative) return { ok: false };
  try {
    secureStage = 'загрузка плагина';
    secureStage = 'запись';
    await KeyVault.set({ key: 'probe', value: 'ok' });
    secureStage = 'чтение';
    const ok = (await secureGet('probe')) === 'ok';
    secureStage = '';
    return ok ? { ok } : { ok, error: 'пробное значение не прочиталось' };
  } catch (e) {
    return { ok: false, error: `${secureStage}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
