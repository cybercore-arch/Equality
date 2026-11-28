import { useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { useSettings } from '../store/settings';
import type { Mode } from '../types';

const field = 'w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';

/** Создание и правка своего режима: название, описание, промпт и параметры. */
export function ModeEditor({ mode, onClose: onCloseProp, onSaved }: { mode?: Mode; onClose: () => void; onSaved?: (id: string) => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const saveMode = useSettings((s) => s.saveMode);
  const deleteMode = useSettings((s) => s.deleteMode);
  const [name, setName] = useState(mode?.name ?? '');
  const [description, setDescription] = useState(mode?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(mode?.systemPrompt ?? '');
  const [temperature, setTemperature] = useState(mode?.temperature ?? 0.7);
  const [topP, setTopP] = useState(mode?.topP ?? 0.95);
  const [googleSearch, setGoogleSearch] = useState(mode?.googleSearch ?? false);

  const save = () => {
    if (!name.trim()) return;
    const id = mode?.id ?? `custom-${crypto.randomUUID().slice(0, 8)}`;
    saveMode({ id, custom: true, name: name.trim().slice(0, 40), description: description.trim().slice(0, 80), systemPrompt: systemPrompt.trim(), temperature, topP, googleSearch });
    onSaved?.(id);
    onClose();
  };

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center`} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl`}
      >
        <h2 className="font-display text-lg font-semibold">{mode ? 'Свой режим' : 'Новый режим'}</h2>
        <div className="mt-3 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (например, Учёба)" maxLength={40} className={field} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко, для карточки (необязательно)" maxLength={80} className={field} />
          <div>
            <div className="mb-1 text-xs text-zinc-500">Промпт режима: как модель должна себя вести</div>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={7} placeholder="Например: Ты репетитор. Объясняй по шагам, проверяй понимание вопросами, не давай готовый ответ сразу." className={`${field} resize-none`} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Креативность (temperature)</span>
              <span>{temperature.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1.5} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[rgb(var(--accent-rgb))]" />
            <div className="text-xs text-zinc-600">Ниже: точнее и суше. Выше: свободнее и разнообразнее.</div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Top P</span>
              <span>{topP.toFixed(2)}</span>
            </div>
            <input type="range" min={0.1} max={1} step={0.05} value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="w-full accent-[rgb(var(--accent-rgb))]" />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={googleSearch} onChange={(e) => setGoogleSearch(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent-rgb))]" />
            <span>
              <span className="block text-zinc-200">Поиск Google (только Gemini)</span>
              <span className="block text-xs text-zinc-500">Работает, если включён в Настройках → Подключение к ИИ.</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={!name.trim()} className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-50">
            Сохранить
          </button>
          {mode && (
            <button
              onClick={() => {
                if (confirm('Удалить режим? Чаты в этом режиме перейдут на «Общение».')) {
                  deleteMode(mode.id);
                  onClose();
                }
              }}
              className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-red-300"
            >
              Удалить
            </button>
          )}
          <button onClick={onClose} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
