/** Читает Server-Sent Events и отдаёт содержимое каждого события (строки `data:`). */
export async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error('Пустой ответ сервера (нет потока)');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let m: RegExpExecArray | null;
      while ((m = /\r?\n\r?\n/.exec(buf))) {
        const raw = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        const data = raw
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function throwHttpError(res: Response): Promise<never> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 400);
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Ключ отклонён (${res.status}). Проверь API-ключ. ${detail}`);
  }
  if (res.status === 429) {
    throw new Error(`Лимит запросов исчерпан (429). Подожди или смени модель. ${detail}`);
  }
  throw new Error(`Ошибка API ${res.status}: ${detail}`);
}
