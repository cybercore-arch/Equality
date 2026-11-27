import { useOverlay } from '../lib/overlay';
import { SEARCH_PROVIDERS } from '../lib/websearch';
import { useSettings } from '../store/settings';

/** Ключ для поиска в интернете (для моделей, у которых нет своего поиска). */
export function SearchSettings({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const provider = useSettings((s) => s.searchProvider);
  const keys = useSettings((s) => s.searchKeys);
  const setProvider = useSettings((s) => s.setSearchProvider);
  const setKey = useSettings((s) => s.setSearchKey);

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center`} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl`}
      >
        <h2 className="font-display text-lg font-semibold">Поиск в интернете</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Для моделей без собственного поиска. Когда из разговора ясно, что нужны свежие данные, модель сама просит поиск, приложение ищет через выбранный сервис, и модель отвечает по результатам. Включается отдельно в настройках каждого чата.
          Сервису уходит только короткий запрос, который сформулировала модель, а не вся переписка. Ключ хранится так же защищённо, как ключи моделей.
        </p>
        <div className="mt-3 space-y-2">
          {SEARCH_PROVIDERS.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-3 ${provider === p.id ? 'border-zinc-500' : 'border-zinc-800'}`}>
              <button onClick={() => setProvider(p.id)} className="flex w-full items-center gap-2 text-left">
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${provider === p.id ? 'border-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb))]' : 'border-zinc-600'}`} />
                <span className="text-sm font-medium">{p.label}</span>
                <span className="min-w-0 truncate text-xs text-zinc-500">{p.hint}</span>
              </button>
              <input
                type="password"
                value={keys[p.id] ?? ''}
                onChange={(e) => setKey(p.id, e.target.value.trim())}
                placeholder="Ключ API"
                autoComplete="off"
                className="mt-2 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
              />
              <div className="mt-1.5 text-xs text-zinc-500">
                Ключ можно получить на <span className="text-zinc-300">{p.keyUrl.replace('https://', '')}</span>. Условия бесплатного плана смотри там.
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-accent mt-4 w-full rounded-2xl py-2.5 text-sm font-medium">
          Готово
        </button>
      </div>
    </div>
  );
}
