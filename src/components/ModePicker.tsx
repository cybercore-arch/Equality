import { MODES } from '../modes';

/** Карточки выбора режима чата. Используется в пустом чате и в настройках чата. */
export function ModePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {MODES.map((m) => {
        const selected = m.id === value;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-200 ${
              selected ? 'border-fg/70 bg-zinc-800' : 'border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-full border transition-colors duration-200 ${
                selected ? 'border-fg bg-fg' : 'border-zinc-600'
              }`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{m.name}</span>
              <span className="block text-xs text-zinc-500">{m.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
