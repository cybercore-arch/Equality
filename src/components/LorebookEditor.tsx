import { useState } from 'react';
import { lorebookToJson } from '../lib/lorebook';
import { useOverlay } from '../lib/overlay';
import { saveFile } from '../lib/saveFile';
import { blankEntry, useRp } from '../store/rp';
import type { Lorebook } from '../types';
import { Collapsible } from './Collapsible';
import { Icon } from './Icon';

/** Правка лорбука: список записей, у каждой ключевые слова и текст. */
export function LorebookEditor({ initial, onClose }: { initial: Lorebook; onClose: () => void }) {
  const { closing, close } = useOverlay(onClose);
  const save = useRp((s) => s.saveLorebook);
  const remove = useRp((s) => s.deleteLorebook);
  const exists = useRp((s) => s.lorebooks.some((b) => b.id === initial.id));
  const [b, setB] = useState<Lorebook>(initial);
  const valid = b.name.trim().length > 0;
  const patchEntry = (id: string, patch: Partial<Lorebook['entries'][number]>) =>
    setB((prev) => ({ ...prev, entries: prev.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const input = 'mt-1.5 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[60] overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">{exists ? 'Лорбук' : 'Новый лорбук'}</h1>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-300">Название</span>
            <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none" />
          </label>

          <p className="text-xs text-zinc-500">
            Запись попадает в запрос к модели, только когда в последних сообщениях встретилось одно из её ключевых слов. Так
            контекст не засоряется. Запись «всегда включена» уходит в каждом запросе.
          </p>

          <div className="space-y-2">
            {b.entries.map((e) => (
              <Collapsible key={e.id} title={e.name || e.keys[0] || 'Новая запись'} hint={e.constant ? 'всегда включена' : e.keys.join(', ') || 'нет ключевых слов'}>
                <label className="block text-sm">
                  <span className="text-zinc-300">Название</span>
                  <input value={e.name} onChange={(ev) => patchEntry(e.id, { name: ev.target.value })} className={input} />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-300">Ключевые слова</span>
                  <span className="ml-2 text-xs text-zinc-500">через запятую</span>
                  <input
                    defaultValue={e.keys.join(', ')}
                    onBlur={(ev) => patchEntry(e.id, { keys: ev.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-300">Текст</span>
                  <textarea value={e.content} rows={6} onChange={(ev) => patchEntry(e.id, { content: ev.target.value })} className={`${input} resize-y`} />
                </label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={e.enabled} onChange={(ev) => patchEntry(e.id, { enabled: ev.target.checked })} className="accent-[rgb(var(--accent-rgb))]" />
                    Включена
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={e.constant} onChange={(ev) => patchEntry(e.id, { constant: ev.target.checked })} className="accent-[rgb(var(--accent-rgb))]" />
                    Всегда
                  </label>
                  <label className="flex items-center gap-2">
                    Важность
                    <input
                      type="number"
                      value={e.order}
                      onChange={(ev) => patchEntry(e.id, { order: Number(ev.target.value) || 0 })}
                      className="w-16 rounded-lg bg-zinc-900 px-2 py-1 text-sm outline-none"
                    />
                  </label>
                </div>
                <button
                  onClick={() => setB({ ...b, entries: b.entries.filter((x) => x.id !== e.id) })}
                  className="text-xs text-red-300 underline underline-offset-2"
                >
                  Удалить запись
                </button>
              </Collapsible>
            ))}
            {b.entries.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">Записей пока нет</div>}
            <button onClick={() => setB({ ...b, entries: [...b.entries, blankEntry()] })} className="w-full rounded-2xl bg-zinc-800 py-2.5 text-sm text-zinc-300">
              Добавить запись
            </button>
          </div>

          <div className="flex gap-2">
            <button
              disabled={!valid}
              onClick={async () => {
                await save({ ...b, name: b.name.trim() });
                close();
              }}
              className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40"
            >
              Сохранить
            </button>
            <button onClick={close} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
              Отмена
            </button>
          </div>

          <div className="flex gap-2 border-t border-zinc-800 pt-4">
            <button
              onClick={() => void saveFile(`${b.name || 'lorebook'}.json`, new Blob([JSON.stringify(lorebookToJson(b), null, 2)], { type: 'application/json' }))}
              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300"
            >
              Экспорт JSON
            </button>
            {exists && (
              <button
                onClick={() => {
                  if (confirm(`Удалить лорбук «${b.name}»?`)) {
                    void remove(b.id);
                    close();
                  }
                }}
                className="ml-auto rounded-xl bg-red-950/50 px-3 py-2 text-xs text-red-300"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
