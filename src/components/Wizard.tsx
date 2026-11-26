import { useEffect, useRef, useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { WIZARD_BUILD, WIZARD_START, WIZARD_SYSTEM, parseWizard, type WizardResult } from '../lib/wizard';
import { streamChat } from '../providers';
import { useChat } from '../store/chat';
import { blankCharacter, useRp } from '../store/rp';
import { useSettings } from '../store/settings';
import { Collapsible } from './Collapsible';
import { Icon } from './Icon';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const field = 'mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500';

/** Мастер «Не знаю, с чего начать»: расспрашивает, собирает набор, показывает превью и создаёт игру. */
export function Wizard({ onClose }: { onClose: () => void }) {
  const { closing, close } = useOverlay(onClose);
  const provider = useSettings((s) => s.providers.find((p) => p.id === s.activeProvider)!);
  const saveCharacter = useRp((s) => s.saveCharacter);
  const savePersona = useRp((s) => s.savePersona);
  const saveLorebook = useRp((s) => s.saveLorebook);
  const start = useChat((s) => s.startWithCharacter);

  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: WIZARD_START }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<WizardResult | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [turns]);

  const hasKey = !!provider.apiKey.trim() || provider.id === 'custom';

  /** Запрос к модели. history — реплики, после которых отвечаем. */
  async function ask(history: Turn[], system: string, temperature: number, onText?: (t: string) => void) {
    ctl.current = new AbortController();
    let acc = '';
    for await (const part of streamChat(provider, {
      // Gemini требует, чтобы разговор начинался с реплики пользователя, поэтому заготовленное приветствие опускаем
      messages: history.slice(Math.max(0, history.findIndex((m) => m.role === 'user'))),
      system,
      temperature,
      topP: 0.95,
      googleSearch: false,
      signal: ctl.current.signal,
    })) {
      acc += part;
      onText?.(acc);
    }
    return acc;
  }

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    setError('');
    const history: Turn[] = [...turns, { role: 'user', content: t }];
    setTurns([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      // Первая реплика помощника — заготовка, модели её показываем как свою
      await ask(history, WIZARD_SYSTEM, 0.8, (acc) => setTurns([...history, { role: 'assistant', content: acc }]));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Ошибка запроса');
      setTurns(history);
    } finally {
      setBusy(false);
    }
  };

  const build = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const raw = await ask([...turns, { role: 'user', content: WIZARD_BUILD }], WIZARD_SYSTEM, 0.9);
      setResult(parseWizard(raw));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Ошибка запроса');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!result) return;
    const t = Date.now();
    let lorebookId: string | undefined;
    if (result.entries.length) {
      lorebookId = crypto.randomUUID();
      await saveLorebook({ id: lorebookId, name: `${result.character.name} — мир`, entries: result.entries, createdAt: t, updatedAt: t });
    }
    const character = { ...blankCharacter(), ...result.character, name: result.character.name.trim() || 'Персонаж', lorebookId };
    await saveCharacter(character);
    let personaId: string | undefined;
    if (result.persona.name.trim()) {
      personaId = crypto.randomUUID();
      await savePersona({ id: personaId, ...result.persona, name: result.persona.name.trim(), createdAt: t, updatedAt: t });
    }
    await start(character.id, personaId);
    close();
  };

  const patchChar = (patch: Partial<WizardResult['character']>) => setResult((r) => r && { ...r, character: { ...r.character, ...patch } });
  const patchEntry = (id: string, patch: Partial<WizardResult['entries'][number]>) =>
    setResult((r) => r && { ...r, entries: r.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[60] flex flex-col bg-zinc-950`}>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">{result ? 'Что получилось' : 'Придумаем игру'}</h1>
        </div>

        {!hasKey && (
          <div className="mb-3 rounded-xl bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
            Для мастера нужен API-ключ: добавь его в Настройки → Подключение к ИИ.
          </div>
        )}

        {result ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-6">
            <p className="text-xs text-zinc-500">Всё можно поправить. Когда готов, нажми «Создать и начать»: персонаж, персона и лорбук сохранятся в библиотеке.</p>
            <Collapsible title="Персонаж" hint={result.character.name} defaultOpen>
              {(
                [
                  ['name', 'Имя', 1],
                  ['description', 'Описание', 6],
                  ['personality', 'Характер', 3],
                  ['scenario', 'Сценарий', 3],
                  ['firstMessage', 'Первое сообщение', 8],
                  ['exampleDialogue', 'Пример диалога', 4],
                ] as const
              ).map(([k, label, rows]) => (
                <label key={k} className="block text-sm">
                  <span className="text-zinc-300">{label}</span>
                  {rows === 1 ? (
                    <input value={result.character[k]} onChange={(e) => patchChar({ [k]: e.target.value })} className={field} />
                  ) : (
                    <textarea value={result.character[k]} rows={rows} onChange={(e) => patchChar({ [k]: e.target.value })} className={`${field} resize-y`} />
                  )}
                </label>
              ))}
            </Collapsible>
            <Collapsible title="Твоя персона" hint={result.persona.name || 'не задана'}>
              <label className="block text-sm">
                <span className="text-zinc-300">Имя</span>
                <input value={result.persona.name} onChange={(e) => setResult({ ...result, persona: { ...result.persona, name: e.target.value } })} className={field} />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-300">Описание</span>
                <textarea value={result.persona.description} rows={4} onChange={(e) => setResult({ ...result, persona: { ...result.persona, description: e.target.value } })} className={`${field} resize-y`} />
              </label>
            </Collapsible>
            <Collapsible title="Лорбук" hint={`записей: ${result.entries.length}`}>
              {result.entries.length === 0 && <p className="text-xs text-zinc-500">Записей нет, лорбук не будет создан.</p>}
              {result.entries.map((e) => (
                <div key={e.id} className="space-y-1.5 rounded-xl bg-zinc-900 p-3">
                  <input value={e.name} onChange={(ev) => patchEntry(e.id, { name: ev.target.value })} placeholder="Название" className="w-full rounded-lg bg-zinc-800 px-2 py-1.5 text-sm outline-none" />
                  <input
                    defaultValue={e.keys.join(', ')}
                    onBlur={(ev) => patchEntry(e.id, { keys: ev.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                    placeholder="Ключевые слова через запятую"
                    className="w-full rounded-lg bg-zinc-800 px-2 py-1.5 text-sm outline-none"
                  />
                  <textarea value={e.content} rows={3} onChange={(ev) => patchEntry(e.id, { content: ev.target.value })} className="w-full resize-y rounded-lg bg-zinc-800 px-2 py-1.5 text-sm outline-none" />
                  <button onClick={() => setResult({ ...result, entries: result.entries.filter((x) => x.id !== e.id) })} className="text-xs text-red-300 underline underline-offset-2">
                    Убрать запись
                  </button>
                </div>
              ))}
            </Collapsible>
            <div className="flex gap-2">
              <button onClick={() => void create()} disabled={!result.character.name.trim()} className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40">
                Создать и начать
              </button>
              <button onClick={() => setResult(null)} className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300">
                К разговору
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`bubble max-w-[88%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed ${t.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                    {t.content || <span className="opacity-50">…</span>}
                  </div>
                </div>
              ))}
              {error && <div className="rounded-xl bg-red-950/60 px-3 py-2 text-xs text-red-200">{error}</div>}
              <div ref={endRef} />
            </div>
            <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => void build()}
                disabled={busy || !hasKey || !turns.some((t) => t.role === 'user')}
                className="mb-2 w-full rounded-2xl border border-fg/20 py-2 text-sm text-zinc-200 disabled:opacity-40"
              >
                {busy && turns[turns.length - 1]?.content === '' ? 'Думаю…' : 'Собрать игру'}
              </button>
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  rows={1}
                  placeholder="Ответ…"
                  onChange={(e) => setText(e.target.value)}
                  className="max-h-32 min-h-[42px] flex-1 resize-none field rounded-2xl px-4 py-2.5 text-[15px] outline-none placeholder:text-zinc-500"
                />
                <button onClick={() => void send()} disabled={!text.trim() || busy || !hasKey} className="btn-accent flex h-[42px] w-[46px] items-center justify-center rounded-2xl disabled:opacity-40" aria-label="Отправить">
                  <Icon name="send" size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
