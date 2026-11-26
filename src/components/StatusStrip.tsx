import { useState } from 'react';
import { useWidgets } from '../widgets/useStates';

const BAR = /^\s*(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/;

/** Виджет «Статус»: компактная полоска параметров под шапкой. Нажми, чтобы развернуть. */
export function StatusStrip() {
  const { enabled, states } = useWidgets();
  const [open, setOpen] = useState(false);
  const fields = states?.status.fields ?? [];
  if (!enabled.includes('status') || fields.length === 0) return null;

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`glass anim-fade flex w-full gap-1.5 border-b border-fg/5 px-3 py-1.5 text-left text-xs ${open ? 'flex-wrap' : 'overflow-x-auto'}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {fields.map(([k, v]) => {
        const m = BAR.exec(v);
        const pct = m ? Math.max(0, Math.min(100, (parseFloat(m[1].replace(',', '.')) / parseFloat(m[2].replace(',', '.'))) * 100)) : null;
        return (
          <span
            key={k}
            className="shrink-0 whitespace-nowrap rounded-full bg-zinc-800 px-2.5 py-1"
            style={pct !== null ? { background: `linear-gradient(to right, rgb(var(--accent-rgb) / 0.3) ${pct}%, rgb(var(--z-800)) ${pct}%)` } : undefined}
          >
            <span className="text-zinc-500">{k} </span>
            <span className="text-zinc-100">{v}</span>
          </span>
        );
      })}
    </button>
  );
}
