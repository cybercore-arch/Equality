import { useTheme, type ThemeMode } from '../store/theme';

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
  { id: 'system', label: 'Авто' },
];

/** Переключатель темы со скользящим ползунком. */
export function ThemeToggle() {
  const mode = useTheme((s) => s.mode);
  const set = useTheme((s) => s.set);
  const idx = Math.max(
    0,
    OPTIONS.findIndex((o) => o.id === mode),
  );

  return (
    <div role="radiogroup" aria-label="Тема" className="relative grid grid-cols-3 rounded-full bg-zinc-800 p-1 text-sm">
      <div
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-zinc-50 shadow transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={mode === o.id}
          onClick={() => set({ mode: o.id })}
          className={`relative z-10 rounded-full py-2 transition-colors duration-300 ${
            mode === o.id ? 'text-zinc-950' : 'text-zinc-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
