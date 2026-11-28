import { useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { useSettings } from '../store/settings';
import type { CustomWidgetDef } from '../widgets/registry';

const field = 'w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';

/** Создание и правка своего виджета: название, что в нём показывать и как он обновляется. */
export function CustomWidgetEditor({ def, onClose: onCloseProp, onSaved }: { def?: CustomWidgetDef; onClose: () => void; onSaved?: (id: string) => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const saveWidget = useSettings((s) => s.saveWidget);
  const deleteWidget = useSettings((s) => s.deleteWidget);
  const [name, setName] = useState(def?.name ?? '');
  const [instruction, setInstruction] = useState(def?.instruction ?? '');
  const [mode, setMode] = useState<CustomWidgetDef['mode']>(def?.mode ?? 'replace');

  const save = () => {
    const n = name.trim().replace(/["<>]/g, '').slice(0, 30);
    if (!n || !instruction.trim()) return;
    const id = def?.id ?? crypto.randomUUID().slice(0, 8);
    saveWidget({ id, name: n, instruction: instruction.trim(), mode });
    onSaved?.(id);
    onClose();
  };

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center`} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl`}
      >
        <h2 className="font-display text-lg font-semibold">{def ? 'Свой виджет' : 'Новый виджет'}</h2>
        <p className="mt-1 text-xs text-zinc-500">Панель с текстом над полем ввода. Модель сама обновляет её по твоим правилам.</p>
        <div className="mt-3 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (например, Инвентарь)" maxLength={30} className={field} />
          <div>
            <div className="mb-1 text-xs text-zinc-500">Что в панели и когда её обновлять</div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={5}
              placeholder="Например: Список предметов героя. Обновляй, когда герой что-то получает, тратит или теряет. Одна строка на предмет, с количеством."
              className={`${field} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['replace', 'Заменять', 'Всегда одно актуальное содержимое'],
                ['log', 'Копить', 'Записи добавляются списком, свежие сверху'],
              ] as const
            ).map(([id, title, hint]) => (
              <button key={id} onClick={() => setMode(id)} className={`rounded-xl border px-3 py-2 text-left ${mode === id ? 'border-fg/70 bg-zinc-800' : 'border-zinc-800'}`}>
                <div className="text-sm">{title}</div>
                <div className="text-xs text-zinc-500">{hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={!name.trim() || !instruction.trim()} className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-50">
            Сохранить
          </button>
          {def && (
            <button
              onClick={() => {
                if (confirm('Удалить виджет? Он пропадёт из всех чатов.')) {
                  deleteWidget(def.id);
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
