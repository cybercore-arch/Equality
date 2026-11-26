import { useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { useRp } from '../store/rp';
import { useSettings } from '../store/settings';
import type { Persona } from '../types';
import { Icon } from './Icon';

/** Создание и правка персоны игрока. */
export function PersonaEditor({ initial, onClose }: { initial: Persona; onClose: () => void }) {
  const { closing, close } = useOverlay(onClose);
  const save = useRp((s) => s.savePersona);
  const remove = useRp((s) => s.deletePersona);
  const exists = useRp((s) => s.personas.some((p) => p.id === initial.id));
  const isDefault = useSettings((s) => s.defaultPersonaId === initial.id);
  const setDefault = useSettings((s) => s.setDefaultPersona);
  const [p, setP] = useState(initial);
  const [def, setDef] = useState(isDefault);
  const valid = p.name.trim().length > 0;

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[60] overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">{exists ? 'Персона' : 'Новая персона'}</h1>
        </div>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-300">Имя</span>
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-300">Описание</span>
            <span className="ml-2 text-xs text-zinc-500">кто ты в этой истории</span>
            <textarea
              value={p.description}
              rows={8}
              onChange={(e) => setP({ ...p, description: e.target.value })}
              className="mt-1.5 w-full resize-y rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={def} onChange={(e) => setDef(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent-rgb))]" />
            Использовать по умолчанию во всех ролевых чатах
          </label>
          <div className="flex gap-2">
            <button
              disabled={!valid}
              onClick={async () => {
                await save({ ...p, name: p.name.trim() });
                if (def) setDefault(p.id);
                else if (isDefault) setDefault(null);
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
          {exists && (
            <button
              onClick={() => {
                if (confirm(`Удалить персону «${p.name}»?`)) {
                  if (isDefault) setDefault(null);
                  void remove(p.id);
                  close();
                }
              }}
              className="rounded-xl bg-red-950/50 px-3 py-2 text-xs text-red-300"
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
