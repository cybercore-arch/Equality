import { useRef, useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { useTheme } from '../store/theme';
import { ThemeToggle } from './ThemeToggle';

const ACCENTS = ['auto', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  const { label, value, min, max, step, onChange, fmt } = props;
  return (
    <label className="block text-sm">
      <div className="flex justify-between text-zinc-300">
        <span>{label}</span>
        <span className="text-zinc-500">{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent-rgb))]"
      />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const px = (v: number) => `${v}px`;

/**
 * Нижняя панель без затемнения: меняешь ползунок — сразу видишь результат в чате сверху.
 */
export function AppearancePanel({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const t = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  return (
    <div className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[58dvh] overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:max-w-md`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Оформление</h2>
        <div className="flex items-center gap-3 text-sm">
          <button className="text-zinc-400" onClick={t.reset}>
            Сбросить
          </button>
          <button onClick={onClose} className="px-1 text-zinc-300">
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <ThemeToggle />
        <div>
          <div className="mb-2 text-sm text-zinc-300">Цвет акцента</div>
          <div className="flex items-center gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => t.set({ accent: c })}
                style={{ background: c === 'auto' ? 'linear-gradient(135deg, #f4f4f5 50%, #18181b 50%)' : c }}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  t.accent === c ? 'scale-110 border-fg' : 'border-zinc-600'
                }`}
                title={c === 'auto' ? 'Авто: подстраивается под тему' : c}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={t.accent === 'auto' ? '#a1a1aa' : t.accent}
              onChange={(e) => t.set({ accent: e.target.value })}
              className="h-8 w-8 rounded-full border-0 bg-transparent p-0"
              title="Свой цвет"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-zinc-800/60 p-3">
          <div className="text-sm font-medium">Фон</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await t.setBackground(f);
                setMsg('');
              } catch (err) {
                setMsg((err as Error).message);
              }
            }}
          />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn-accent rounded-lg px-3 py-1.5 text-sm">
              Выбрать картинку
            </button>
            <button onClick={() => void t.clearBackground()} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm">
              Убрать
            </button>
          </div>
          {msg && <div className="text-xs text-red-300">{msg}</div>}
          <Slider label="Размытие фона" value={t.bgBlur} min={0} max={30} step={1} fmt={px} onChange={(v) => t.set({ bgBlur: v })} />
          <Slider label="Затемнение фона" value={t.bgDim} min={0} max={0.9} step={0.05} fmt={pct} onChange={(v) => t.set({ bgDim: v })} />
        </div>

        <Slider label="Прозрачность сообщений" value={t.bubbleAlpha} min={0.15} max={1} step={0.05} fmt={pct} onChange={(v) => t.set({ bubbleAlpha: v })} />
        <Slider label="Прозрачность панелей" value={t.panelAlpha} min={0.15} max={1} step={0.05} fmt={pct} onChange={(v) => t.set({ panelAlpha: v })} />
        <Slider label="Размытие стекла" value={t.blur} min={0} max={32} step={1} fmt={px} onChange={(v) => t.set({ blur: v })} />
        <Slider label="Скругление сообщений" value={t.radius} min={4} max={28} step={1} fmt={px} onChange={(v) => t.set({ radius: v })} />
        <Slider label="Размер текста" value={t.fontSize} min={13} max={20} step={1} fmt={px} onChange={(v) => t.set({ fontSize: v })} />
      </div>
    </div>
  );
}
