import { useRef, useState } from 'react';
import { applyBackup, exportBackup, openBackup, parseBackup, summarize, type BackupFile, type BackupSummary } from '../lib/backup';
import { useOverlay } from '../lib/overlay';

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent-rgb))]" />
      <span className="min-w-0">
        <span className="block text-zinc-200">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

const input = 'w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';

/** Резервная копия: сохранить всё в файл и восстановить из файла. */
export function BackupScreen({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);

  // экспорт
  const [withKeys, setWithKeys] = useState(false);
  const [pass, setPass] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // импорт
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [impPass, setImpPass] = useState('');
  const [sum, setSum] = useState<BackupSummary | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof openBackup>> | null>(null);
  const [impErr, setImpErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function doExport() {
    setExporting(true);
    setExportMsg('');
    try {
      await exportBackup({ includeKeys: withKeys, password: pass });
      setExportMsg('Готово. Файл передан в «Поделиться» — сохраните его в надёжное место.');
    } catch (e) {
      setExportMsg(`Не получилось: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setImpErr('');
    setDone('');
    setSum(null);
    setData(null);
    setFile(null);
    try {
      const parsed = await parseBackup(await f.text());
      setFile(parsed);
      if (!parsed.encrypted) {
        const d = await openBackup(parsed, '');
        setData(d);
        setSum(summarize(parsed, d));
      }
    } catch (e) {
      setImpErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function unlock() {
    if (!file) return;
    setImpErr('');
    setBusy(true);
    try {
      const d = await openBackup(file, impPass);
      setData(d);
      setSum(summarize(file, d));
    } catch (e) {
      setImpErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function run(mode: 'merge' | 'replace') {
    if (!data) return;
    setBusy(true);
    setImpErr('');
    try {
      await applyBackup(data, mode);
      if (mode === 'replace') {
        window.location.reload();
        return;
      }
      setDone('Готово: недостающие чаты, персонажи и лорбуки добавлены. Обновите список чатов, перезапустив приложение.');
      setData(null);
      setSum(null);
    } catch (e) {
      setImpErr(`Не получилось: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setConfirmReplace(false);
    }
  }

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center`} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl`}
      >
        <h2 className="font-display text-lg font-semibold">Резервная копия и перенос</h2>
        <p className="mt-1 text-xs text-zinc-500">Всё делается на этом устройстве, файл никуда не отправляется. Подходит для переноса на другой телефон и для страховки.</p>

        <section className="mt-4 space-y-3 rounded-2xl bg-zinc-800/50 p-4">
          <h3 className="text-sm font-medium">Сохранить в файл</h3>
          <p className="text-xs text-zinc-500">Чаты, сообщения, папки, персонажи, персоны, лорбуки, настройки, оформление и фон.</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Пароль для шифрования (необязательно)" className={input} autoComplete="new-password" />
          <Check
            checked={withKeys && !!pass}
            onChange={(v) => setWithKeys(v)}
            label="Включить API-ключи"
            hint={pass ? 'Файл зашифрован паролем. Без пароля восстановить его нельзя — не потеряйте.' : 'Доступно только с паролем: без шифрования ключи лежали бы в файле открытым текстом.'}
          />
          <button onClick={() => void doExport()} disabled={exporting} className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-50">
            {exporting ? 'Собираю…' : 'Сохранить копию'}
          </button>
          {exportMsg && <p className="text-xs text-zinc-400">{exportMsg}</p>}
        </section>

        <section className="mt-3 space-y-3 rounded-2xl bg-zinc-800/50 p-4">
          <h3 className="text-sm font-medium">Восстановить из файла</h3>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl bg-zinc-800 py-2.5 text-sm text-zinc-200">
            Выбрать файл
          </button>

          {file?.encrypted && !data && (
            <div className="space-y-2">
              <input type="password" value={impPass} onChange={(e) => setImpPass(e.target.value)} placeholder="Пароль от копии" className={input} autoComplete="off" />
              <button onClick={() => void unlock()} disabled={busy} className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-50">
                {busy ? 'Проверяю…' : 'Открыть'}
              </button>
            </div>
          )}

          {sum && data && (
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                Копия от {new Date(sum.createdAt).toLocaleString()}: чатов {sum.chats}, сообщений {sum.messages}, персонажей {sum.characters}, персон {sum.personas}, лорбуков {sum.lorebooks}
                {sum.hasKeys ? ', с API-ключами' : ', без API-ключей'}.
              </div>
              <button onClick={() => void run('merge')} disabled={busy} className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-50">
                Добавить к текущим
              </button>
              <p className="-mt-1 text-xs text-zinc-500">Добавит то, чего нет на этом устройстве. Существующее и настройки не изменятся.</p>
              {!confirmReplace ? (
                <button onClick={() => setConfirmReplace(true)} disabled={busy} className="w-full rounded-2xl bg-zinc-800 py-2.5 text-sm text-zinc-200 disabled:opacity-50">
                  Заменить всё
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-red-500/40 p-3">
                  <p className="text-xs text-red-300">Все текущие чаты, персонажи и настройки на этом устройстве будут удалены и заменены копией. Это нельзя отменить.</p>
                  <div className="flex gap-2">
                    <button onClick={() => void run('replace')} disabled={busy} className="flex-1 rounded-xl bg-red-500/80 py-2 text-sm font-medium text-white disabled:opacity-50">
                      {busy ? 'Заменяю…' : 'Да, заменить'}
                    </button>
                    <button onClick={() => setConfirmReplace(false)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {impErr && <p className="text-xs text-red-400">{impErr}</p>}
          {done && <p className="text-xs text-zinc-400">{done}</p>}
        </section>

        <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-zinc-800 py-2.5 text-sm text-zinc-300">
          Закрыть
        </button>
      </div>
    </div>
  );
}
