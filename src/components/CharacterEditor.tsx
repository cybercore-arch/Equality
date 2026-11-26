import { useRef, useState } from 'react';
import { exportJson, exportPng, makeAvatar } from '../lib/card';
import { useOverlay } from '../lib/overlay';
import { saveFile } from '../lib/saveFile';
import { useRp } from '../store/rp';
import type { Character } from '../types';
import { Avatar } from './Avatar';
import { Collapsible } from './Collapsible';
import { Icon } from './Icon';

function Field({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  single,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  single?: boolean;
}) {
  const cls = 'mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';
  return (
    <label className="block text-sm">
      <span className="text-zinc-300">{label}</span>
      {hint && <span className="ml-2 text-xs text-zinc-500">{hint}</span>}
      {single ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-y`} />
      )}
    </label>
  );
}

/** Создание и правка карточки персонажа. */
export function CharacterEditor({ initial, onClose }: { initial: Character; onClose: () => void }) {
  const { closing, close } = useOverlay(onClose);
  const save = useRp((s) => s.saveCharacter);
  const remove = useRp((s) => s.deleteCharacter);
  const exists = useRp((s) => s.characters.some((c) => c.id === initial.id));
  const lorebooks = useRp((s) => s.lorebooks);
  const [c, setC] = useState<Character>(initial);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Character>) => setC((prev) => ({ ...prev, ...patch }));

  const valid = c.name.trim().length > 0;

  const pickAvatar = async (f: File | undefined) => {
    if (!f) return;
    try {
      set({ avatar: await makeAvatar(f) });
    } catch {
      setNote('Не удалось открыть картинку');
    }
  };

  const doSave = async () => {
    if (!valid) return;
    await save({ ...c, name: c.name.trim() });
    close();
  };

  const doExport = async (kind: 'json' | 'png') => {
    const card = { ...c, name: c.name.trim() || 'character' };
    try {
      const book = lorebooks.find((b) => b.id === c.lorebookId);
      const blob = kind === 'json' ? exportJson(card, book) : await exportPng(card, book);
      await saveFile(`${card.name}.${kind}`, blob);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не удалось сохранить файл');
    }
  };

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[60] overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">{exists ? 'Персонаж' : 'Новый персонаж'}</h1>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button onClick={() => fileRef.current?.click()} aria-label="Сменить аватар">
              <Avatar src={c.avatar} name={c.name} size={72} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickAvatar(e.target.files?.[0])} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500">Нажми на аватар, чтобы выбрать картинку</div>
              {c.avatar && (
                <button onClick={() => set({ avatar: undefined })} className="mt-1 text-xs text-zinc-500 underline underline-offset-2">
                  Убрать аватар
                </button>
              )}
            </div>
          </div>

          <Field label="Имя" value={c.name} onChange={(v) => set({ name: v })} single />
          <Field label="Описание" hint="внешность, роль, предыстория" value={c.description} onChange={(v) => set({ description: v })} rows={6} />
          <Field label="Характер" value={c.personality} onChange={(v) => set({ personality: v })} />
          <Field label="Сценарий" hint="где и как начинается история" value={c.scenario} onChange={(v) => set({ scenario: v })} />
          <Field label="Первое сообщение" hint="с него начнётся чат" value={c.firstMessage} onChange={(v) => set({ firstMessage: v })} rows={6} />

          <Collapsible title="Другие приветствия" hint={c.alternateGreetings.length ? `${c.alternateGreetings.length} шт., листаются как варианты ответа` : 'необязательно'}>
            {c.alternateGreetings.map((g, i) => (
              <div key={i} className="space-y-1">
                <textarea
                  value={g}
                  rows={4}
                  onChange={(e) => set({ alternateGreetings: c.alternateGreetings.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="w-full resize-y rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={() => set({ alternateGreetings: c.alternateGreetings.filter((_, j) => j !== i) })}
                  className="text-xs text-zinc-500 underline underline-offset-2"
                >
                  Удалить
                </button>
              </div>
            ))}
            <button onClick={() => set({ alternateGreetings: [...c.alternateGreetings, ''] })} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
              Добавить приветствие
            </button>
          </Collapsible>

          <label className="block text-sm">
            <span className="text-zinc-300">Лорбук персонажа</span>
            <span className="ml-2 text-xs text-zinc-500">подключается к новым чатам с ним</span>
            <select
              value={c.lorebookId ?? ''}
              onChange={(e) => set({ lorebookId: e.target.value || undefined })}
              className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">Без лорбука</option>
              {lorebooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <Collapsible title="Дополнительно" hint="пример диалога, свой промпт, заметки">
            <Field label="Пример диалога" hint="как персонаж говорит" value={c.exampleDialogue} onChange={(v) => set({ exampleDialogue: v })} rows={6} />
            <Field label="Системный промпт карточки" value={c.systemPrompt} onChange={(v) => set({ systemPrompt: v })} />
            <Field label="Заметки автора" value={c.creatorNotes} onChange={(v) => set({ creatorNotes: v })} />
            <Field
              label="Теги"
              hint="через запятую"
              value={c.tags.join(', ')}
              onChange={(v) => set({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })}
              single
            />
          </Collapsible>

          <p className="text-xs text-zinc-500">В тексте можно писать {'{{char}}'} (имя персонажа) и {'{{user}}'} (имя твоей персоны). Они подставятся сами.</p>

          {note && <div className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300">{note}</div>}

          <div className="flex gap-2">
            <button onClick={() => void doSave()} disabled={!valid} className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40">
              Сохранить
            </button>
            <button onClick={close} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
              Отмена
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <button onClick={() => void doExport('png')} className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
              Экспорт PNG
            </button>
            <button onClick={() => void doExport('json')} className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
              Экспорт JSON
            </button>
            {exists && (
              <button
                onClick={() => {
                  if (confirm(`Удалить персонажа «${c.name}»? Чаты с ним останутся.`)) {
                    void remove(c.id);
                    close();
                  }
                }}
                className="ml-auto rounded-xl bg-red-950/50 px-3 py-2 text-xs text-red-300"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
