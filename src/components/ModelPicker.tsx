import { useState } from 'react';
import { formatContext } from '../lib/tokens';
import { listModels } from '../providers/models';
import type { ModelInfo, ProviderConfig } from '../types';

/** Кнопка «Выбрать из списка»: загружает актуальные модели провайдера и даёт отфильтровать по тексту. */
export function ModelPicker({
  cfg,
  onPick,
}: {
  cfg: ProviderConfig;
  /** Второй аргумент: размер контекста модели, если провайдер его сообщил */
  onPick: (id: string, context?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    setOpen(true);
    setLoading(true);
    setErr('');
    try {
      setItems(await listModels(cfg));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const shown = (items ?? []).filter((m) => m.id.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mt-2">
      <button
        onClick={() => (open ? setOpen(false) : void load())}
        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        {open ? 'Скрыть список' : 'Выбрать из списка моделей'}
      </button>

      {open && (
        <div className="anim-fade mt-2 rounded-xl bg-zinc-800/60 p-2">
          {loading && <div className="px-2 py-1 text-xs text-zinc-400">Загружаю…</div>}
          {err && <div className="break-words px-2 py-1 text-xs text-red-300">{err}</div>}
          {items && (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Поиск среди ${items.length} моделей`}
                className="mb-1 w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-xs outline-none"
              />
              <div className="max-h-48 overflow-y-auto">
                {shown.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onPick(m.id, m.context);
                      setOpen(false);
                    }}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-zinc-700 ${
                      m.id === cfg.model ? 'text-zinc-50' : 'text-zinc-300'
                    }`}
                  >
                    <span className="min-w-0 break-all">{m.id}</span>
                    {m.context ? <span className="shrink-0 text-zinc-500">{formatContext(m.context)}</span> : null}
                  </button>
                ))}
                {shown.length === 0 && <div className="px-2 py-1 text-xs text-zinc-500">Ничего не найдено</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
