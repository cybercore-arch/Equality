import { useEffect, useRef, useState } from 'react';
import type { WidgetOp } from '../../types';
import type { RollState } from '../../widgets/registry';

const SIDES: Record<string, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

const rnd = (n: number) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % n) + 1;
};

/** Кубики: бросок сразу уходит модели обычным сообщением. */
export function DiceWidget({ state, busy, onRoll }: { state: RollState; busy: boolean; onRoll: (text: string, ops: WidgetOp[]) => void }) {
  const [die, setDie] = useState('d20');
  const [count, setCount] = useState(1);
  const [mod, setMod] = useState(0);
  const [shown, setShown] = useState<string>('—');
  const [rolling, setRolling] = useState(false);
  const timer = useRef<number>(0);

  // Модель просит бросок конкретного кубика: выбираем его сами
  const req = state.pending ? `${state.pending.d}|${state.pending.reason}` : '';
  useEffect(() => {
    if (state.pending && SIDES[state.pending.d]) {
      setDie(state.pending.d);
      setShown('—');
    }
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => window.clearInterval(timer.current), []);

  const roll = () => {
    if (busy || rolling) return;
    const sides = SIDES[die];
    const rolls = Array.from({ length: count }, () => rnd(sides));
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    setRolling(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      setShown(String(rnd(sides) * count));
      if (++n < 8) return;
      window.clearInterval(timer.current);
      setShown(String(total));
      setRolling(false);
      const bonus = mod ? `${mod > 0 ? '+' : ''}${mod}` : '';
      onRoll(`🎲 ${count}${die}${bonus}: [${rolls.join(', ')}]${mod ? ` ${mod > 0 ? '+' : '−'}${Math.abs(mod)}` : ''} = ${total}`, [{ w: 'roll', t: 'rolled' }]);
    }, 60);
  };

  const step = (label: string, value: string, change: (d: number) => void) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <button onClick={() => change(-1)} className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300">
        −
      </button>
      <b className="min-w-7 text-center">{value}</b>
      <button onClick={() => change(1)} className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300">
        +
      </button>
    </div>
  );

  return (
    <div className="pb-1">
      {state.pending && (
        <div className="anim-rise mb-2 rounded-xl bg-[rgb(var(--accent-rgb))] px-3 py-2 text-sm font-medium text-[rgb(var(--on-accent))]">
          Нужен бросок {state.pending.d}
          {state.pending.reason ? `: ${state.pending.reason}` : ''}
        </div>
      )}
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {Object.keys(SIDES).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDie(d);
              setShown('—');
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${d === die ? 'bg-fg text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="mb-1 flex items-center justify-between">
        {step('Кубиков', String(count), (d) => setCount((c) => Math.max(1, Math.min(10, c + d))))}
        {step('Бонус', `${mod > 0 ? '+' : ''}${mod}`, (d) => setMod((m) => Math.max(-20, Math.min(20, m + d))))}
      </div>
      <div className={`py-2 text-center font-display text-4xl font-bold transition-transform ${rolling ? 'scale-110' : ''}`}>{shown}</div>
      <button onClick={roll} disabled={busy || rolling} className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40">
        {busy ? 'Подожди ответа…' : 'Бросить'}
      </button>
    </div>
  );
}
