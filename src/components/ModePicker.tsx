import { useState } from 'react';
import { allModes } from '../modes';
import { useSettings } from '../store/settings';
import type { Mode } from '../types';
import { Icon } from './Icon';
import { ModeEditor } from './ModeEditor';

/** Карточки выбора режима чата. Используется в пустом чате и в настройках чата. Свои режимы можно создать и править. */
export function ModePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const custom = useSettings((s) => s.customModes);
  const [editing, setEditing] = useState<Mode | 'new' | null>(null);

  return (
    <div className="space-y-2">
      {allModes(custom).map((m) => {
        const selected = m.id === value;
        return (
          <div
            key={m.id}
            className={`flex items-center rounded-2xl border transition-colors duration-200 ${selected ? 'border-fg/70 bg-zinc-800' : 'border-zinc-800 hover:border-zinc-600'}`}
          >
            <button onClick={() => onChange(m.id)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
              <span className={`h-3 w-3 shrink-0 rounded-full border transition-colors duration-200 ${selected ? 'border-fg bg-fg' : 'border-zinc-600'}`} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{m.name}</span>
                {m.description && <span className="block truncate text-xs text-zinc-500">{m.description}</span>}
              </span>
            </button>
            {m.custom && (
              <button onClick={() => setEditing(m)} aria-label="Изменить режим" className="mr-2 rounded-lg p-2 text-zinc-500 hover:text-zinc-200">
                <Icon name="edit" size={16} />
              </button>
            )}
          </div>
        );
      })}
      <button onClick={() => setEditing('new')} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-400 hover:border-zinc-500">
        <Icon name="plus" size={16} />
        Свой режим
      </button>
      {editing && <ModeEditor mode={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(id) => editing === 'new' && onChange(id)} />}
    </div>
  );
}
