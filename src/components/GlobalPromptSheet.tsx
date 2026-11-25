import { useState } from 'react';
import { useSettings } from '../store/settings';

/** Общий системный промпт: добавляется во все чаты всех режимов. */
export function GlobalPromptSheet({ onClose }: { onClose: () => void }) {
  const value = useSettings((s) => s.globalPrompt);
  const setGlobalPrompt = useSettings((s) => s.setGlobalPrompt);
  const [draft, setDraft] = useState(value);

  return (
    <div className="anim-fade fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl"
      >
        <h2 className="font-display text-lg font-semibold">Общий системный промпт</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Добавляется во все чаты всех режимов, перед промптом режима. Например: «Отвечай по-русски. Обращайся ко мне на ты.»
          В любом чате его можно выключить отдельно.
        </p>
        <textarea
          autoFocus
          value={draft}
          rows={9}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Пусто: общий промпт не используется"
          className="mt-3 w-full resize-none rounded-2xl bg-zinc-800 px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setGlobalPrompt(draft.trim());
              onClose();
            }}
            className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium"
          >
            Сохранить
          </button>
          <button onClick={onClose} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
