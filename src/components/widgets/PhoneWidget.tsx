import { useEffect, useRef, useState } from 'react';
import type { PhoneState } from '../../widgets/registry';
import { Icon } from '../Icon';

/** Цвет аватарки контакта выбирается по имени, чтобы у каждого был свой. */
function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function ContactAvatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue(name)} 45% 38%)` }}
      className="flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white"
    >
      {(name[0] ?? '?').toUpperCase()}
    </span>
  );
}

interface Props {
  state: PhoneState;
  busy: boolean;
  /** Во весь экран: переписка занимает всё место */
  full?: boolean;
  contact: string | null;
  onContact: (name: string) => void;
  /** Сколько сообщений пользователя ещё без ответа модели */
  pending: number;
  /** Отправить сообщение в чат БЕЗ запроса к модели */
  onSend: (to: string, text: string) => void;
  /** Попросить модель ответить прямо сейчас */
  onAsk: () => void;
}

/** Мессенджер: контакты, переписка, поле ввода. Сообщения копятся и уходят модели вместе со следующим сообщением в чате. */
export function PhoneWidget({ state, busy, full, contact, onContact, pending, onSend, onAsk }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const order = [...state.order].reverse();
  const current = adding ? null : contact && state.threads[contact] ? contact : (order[0] ?? null);
  const msgs = (current && state.threads[current]) || [];

  // К последнему сообщению при новых сообщениях, смене контакта и раскрытии
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, current, full]);

  const to = adding ? name.trim() : current;
  const canSend = !!text.trim() && !!to;

  const send = () => {
    if (!canSend || !to) return;
    onSend(to, text.trim());
    setText('');
    if (adding) {
      onContact(to);
      setAdding(false);
      setName('');
    }
  };

  const unread = (c: string) => c !== current && state.threads[c]?.slice(-1)[0]?.from === 'them';

  return (
    <div className={`flex flex-col ${full ? 'h-full' : ''}`}>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {order.map((c) => (
          <button
            key={c}
            onClick={() => {
              setAdding(false);
              onContact(c);
            }}
            className={`relative flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-colors ${
              c === current && !adding ? 'bg-fg text-zinc-950' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            <ContactAvatar name={c} size={24} />
            {c}
            {unread(c) && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[rgb(var(--accent-rgb))] ring-2 ring-zinc-900" />}
          </button>
        ))}
        <button
          onClick={() => setAdding(true)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${adding ? 'bg-fg text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}
        >
          + Новый
        </button>
      </div>

      {full && current && !adding && (
        <div className="mb-2 flex items-center gap-3 px-1">
          <ContactAvatar name={current} size={44} />
          <div className="min-w-0">
            <div className="truncate font-medium">{current}</div>
            <div className="text-xs text-zinc-500">{busy ? 'печатает…' : 'в сети'}</div>
          </div>
        </div>
      )}

      {adding && (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Кому написать (имя)"
          className="mb-2 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
        />
      )}

      <div
        ref={threadRef}
        className={`flex flex-col gap-1.5 overflow-y-auto px-0.5 pb-2 ${full ? 'min-h-0 flex-1' : 'max-h-52 min-h-16'}`}
      >
        {msgs.length === 0 && (
          <div className="m-auto py-4 text-center text-sm text-zinc-500">{adding ? 'Напиши первое сообщение' : 'Сообщений пока нет'}</div>
        )}
        {msgs.map((m, i) => {
          const me = m.from === 'me';
          return (
            <div
              key={i}
              className={`anim-rise max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 ${full ? 'text-[15px]' : 'text-sm'} ${
                me
                  ? 'self-end rounded-2xl rounded-br-md bg-[rgb(var(--accent-rgb))] text-[rgb(var(--on-accent))]'
                  : 'self-start rounded-2xl rounded-bl-md bg-zinc-800 text-zinc-100'
              }`}
              style={{ animationDuration: '0.25s' }}
            >
              {m.text}
            </div>
          );
        })}
      </div>

      {pending > 0 && !busy && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-zinc-800/70 px-3 py-1.5 text-xs text-zinc-400">
          <span className="min-w-0 flex-1">Ждут ответа модели: {pending}. Она прочитает их, когда ты напишешь в чат.</span>
          <button onClick={onAsk} className="shrink-0 rounded-lg bg-zinc-700 px-2.5 py-1 text-zinc-100">
            Отправить сейчас
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          enterKeyHint="send"
          placeholder={to ? `Сообщение для ${to}…` : 'Сообщение…'}
          className="min-w-0 flex-1 rounded-full bg-zinc-800 px-4 py-2.5 text-[15px] outline-none placeholder:text-zinc-500"
        />
        <button
          onClick={send}
          disabled={!canSend}
          className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          aria-label="Отправить в телефон"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}
