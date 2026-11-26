import { useRef, useState } from 'react';
import { importCardFile } from '../lib/card';
import { useOverlay } from '../lib/overlay';
import { blankCharacter, blankPersona, useRp } from '../store/rp';
import { useSettings } from '../store/settings';
import type { Character, Persona } from '../types';
import { Avatar } from './Avatar';
import { CharacterEditor } from './CharacterEditor';
import { Icon } from './Icon';
import { PersonaEditor } from './PersonaEditor';

/** Библиотека ролплея: персонажи и персоны. Здесь же импорт карточек. */
export function CharactersScreen({ onClose, onPick }: { onClose: () => void; onPick?: (id: string) => void }) {
  const { closing, close } = useOverlay(onClose);
  const characters = useRp((s) => s.characters);
  const personas = useRp((s) => s.personas);
  const saveCharacter = useRp((s) => s.saveCharacter);
  const defaultPersonaId = useSettings((s) => s.defaultPersonaId);
  const [tab, setTab] = useState<'chars' | 'personas'>('chars');
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (list: FileList | null) => {
    if (!list?.length) return;
    const errors: string[] = [];
    let done = 0;
    for (const f of Array.from(list)) {
      try {
        const card = await importCardFile(f);
        const t = Date.now();
        await saveCharacter({ ...card, id: crypto.randomUUID(), createdAt: t, updatedAt: t });
        done++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    setNote([done ? `Импортировано: ${done}` : '', ...errors].filter(Boolean).join('\n'));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-50 overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="flex-1 font-display text-xl font-semibold">Персонажи и персоны</h1>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-900 p-1 text-sm">
          {(['chars', 'personas'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl py-2 transition-colors ${tab === t ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400'}`}
            >
              {t === 'chars' ? `Персонажи · ${characters.length}` : `Персоны · ${personas.length}`}
            </button>
          ))}
        </div>

        {note && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note}</span>
            <button onClick={() => setNote('')} aria-label="Закрыть">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {tab === 'chars' ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setEditChar(blankCharacter())} className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium">
                Создать
              </button>
              <button onClick={() => fileRef.current?.click()} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
                Импорт
              </button>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => void doImport(e.target.files)} />
            </div>
            <p className="text-xs text-zinc-500">Импорт: карточки из SillyTavern, Chub и других сайтов (файлы .png или .json).</p>
            {characters.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Персонажей пока нет</div>}
            {characters.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3">
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => (onPick ? (onPick(c.id), close()) : setEditChar(c))}
                >
                  <Avatar src={c.avatar} name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{c.description.replace(/\s+/g, ' ') || 'Без описания'}</span>
                  </span>
                </button>
                {onPick && (
                  <button onClick={() => setEditChar(c)} className="rounded-xl p-2 text-zinc-400" aria-label="Изменить">
                    <Icon name="edit" size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={() => setEditPersona(blankPersona())} className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium">
              Создать персону
            </button>
            <p className="text-xs text-zinc-500">Персона — это ты в истории: имя и описание. Модель будет обращаться к тебе соответственно.</p>
            {personas.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Персон пока нет</div>}
            {personas.map((p) => (
              <button key={p.id} onClick={() => setEditPersona(p)} className="flex w-full items-center gap-3 rounded-2xl bg-zinc-900 p-3 text-left">
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{p.description.replace(/\s+/g, ' ') || 'Без описания'}</span>
                </span>
                {defaultPersonaId === p.id && <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">по умолчанию</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {editChar && <CharacterEditor initial={editChar} onClose={() => setEditChar(null)} />}
      {editPersona && <PersonaEditor initial={editPersona} onClose={() => setEditPersona(null)} />}
    </div>
  );
}
