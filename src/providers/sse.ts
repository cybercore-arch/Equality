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

/** Ошибка HTTP с кодом статуса: по нему решаем, стоит ли повторять запрос. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function throwHttpError(res: Response): Promise<never> {
  let detail = '';
  try {
    const raw = (await res.text()).slice(0, 2000);
    try {
      const err = JSON.parse(raw)?.error;
      detail = err?.message ?? raw;
      // У OpenRouter настоящая причина часто лежит в metadata.raw («Provider returned error» ничего не объясняет)
      const extra = err?.metadata?.raw;
      if (extra) detail += `\n${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
    } catch {
      detail = raw;
    }
  } catch {
    /* ignore */
  }
  detail = String(detail).slice(0, 300);

  if (res.status === 401 || res.status === 403) {
    throw new HttpError(res.status, `Ключ отклонён (${res.status}). Проверь API-ключ.\n${detail}`);
  }
  if (res.status === 404) {
    throw new HttpError(res.status, `Модель не найдена (404). Выбери другую в ⚙ через «Выбрать из списка моделей».\n${detail}`);
  }
  if (res.status === 429) {
    const gemini = res.url.includes('generativelanguage');
    throw new HttpError(
      res.status,
      `Лимит запросов (429). Бесплатный лимит этой модели исчерпан или она перегружена. Подожди минуту и нажми «Повторить» или выбери другую модель в ⚙.` +
        (gemini ? ' Для Gemini также выключи поиск Google в ⚙: на бесплатных ключах он часто недоступен.' : '') +
        `\n${detail}`,
    );
  }
  if (res.status >= 500) {
    throw new HttpError(res.status, `Модель перегружена или недоступна (${res.status}). Это временно: нажми «Повторить» или выбери другую модель.\n${detail}`);
  }
  throw new HttpError(res.status, `Ошибка API ${res.status}: ${detail}`);
}
