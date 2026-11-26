import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { dataUrl } from '../lib/attachments';
import { stripWidgetTags } from '../widgets/registry';
import { ROOT, useChat } from '../store/chat';
import type { MessageStats } from '../types';
import { Icon, type IconName } from './Icon';

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? '').replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className ?? '')?.[1];
  const isBlock = !!lang || text.includes('\n');
  if (!isBlock) return <code>{children}</code>;

  return (
    <div className="my-2 max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between bg-zinc-800/70 px-3 py-1 text-xs text-zinc-400">
        <span>{lang ?? 'code'}</span>
        <button
          className="rounded px-2 py-0.5 hover:bg-zinc-700"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      {/* Прокручивается только это окошко, а не всё сообщение */}
      <pre className="max-w-full overflow-x-auto p-3 text-sm">
        <code>{text}</code>
      </pre>
    </div>
  );
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md min-w-0 max-w-full break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock, pre: ({ children }) => <>{children}</> }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

const STAGES = [
  { from: 0, label: 'Читает' },
  { from: 1500, label: 'Думает' },
  { from: 6000, label: 'Всё ещё думает' },
  { from: 20000, label: 'Модель отвечает долго' },
];

/** Пока ответа нет: пульсирующие точки и стадия, которая меняется со временем. */
function StatusLine() {
  const note = useChat((s) => s.statusNote);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const h = setInterval(() => {
      const e = Date.now() - t0;
      let k = 0;
      STAGES.forEach((s, j) => {
        if (e >= s.from) k = j;
      });
      setI(k);
    }, 400);
    return () => clearInterval(h);
  }, []);

  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="flex gap-1">
        {[0, 1, 2].map((d) => (
          <i key={d} className="typing-dot" style={{ animationDelay: `${d * 160}ms` }} />
        ))}
      </span>
      <span key={note ?? i} className="shimmer anim-fade text-sm">
        {note ?? STAGES[i].label}
      </span>
    </div>
  );
}

const sec = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} с`;

function StatsLine({ s }: { s: MessageStats }) {
  return (
    <span>
      {sec(s.ttftMs)} до ответа · {sec(s.totalMs)} всего · {s.approx ? '≈' : ''}
      {s.tokens} ток.
    </span>
  );
}

function Chip({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs transition-colors enabled:hover:bg-zinc-700 disabled:opacity-30 ${
        danger ? 'text-red-300' : 'text-zinc-300'
      }`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

/**
 * Каждое сообщение подписано только на СВОИ данные.
 * Пока идёт стриминг, перерисовывается ровно один компонент — стримящийся.
 * Во время стриминга показываем простой текст, а Markdown включаем по завершении (это дёшево и без лагов).
 */
export const MessageItem = memo(function MessageItem({ id, isLast }: { id: string; isLast: boolean }) {
  const m = useChat((s) => s.messages[id]);
  const streamText = useChat((s) => (s.streamingId === id ? s.streamText : null));
  const sibs = useChat((s) => s.children[m?.parentId ?? ROOT]);
  const busy = useChat((s) => s.streamingId !== null);
  const swipe = useChat((s) => s.swipe);
  const regenerate = useChat((s) => s.regenerate);
  const retry = useChat((s) => s.retry);
  const continueMessage = useChat((s) => s.continueMessage);
  const editMessage = useChat((s) => s.editMessage);
  const deleteMessage = useChat((s) => s.deleteMessage);
  const forkFrom = useChat((s) => s.forkFrom);

  // Анимируем только свежие сообщения, а не те, что появились при прокрутке старой истории
  const fresh = useRef(m ? Date.now() - m.createdAt < 1500 : false).current;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [wish, setWish] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!m) return null;
  const isUser = m.role === 'user';
  const streaming = streamText !== null;
  const raw = streaming ? streamText : m.content;
  // Служебные теги виджетов (<phone>, <status>, <roll>) пользователю не показываем
  const text = isUser ? raw : stripWidgetTags(raw);
  const idx = sibs ? sibs.indexOf(id) : 0;
  const count = sibs?.length ?? 1;
  const showActions = !streaming && !editing && (isLast || showMore);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  const saveEdit = () => {
    void editMessage(id, draft);
    setEditing(false);
  };

  return (
    <div className={`flex px-3 py-1.5 ${isUser ? 'justify-end' : 'justify-start'} ${fresh ? 'anim-msg' : ''}`}>
      <div className={`flex min-w-0 flex-col ${editing ? 'w-[92%]' : 'max-w-[92%] md:max-w-[75%]'} ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`bubble min-w-0 max-w-full px-3.5 py-2 leading-relaxed ${editing ? 'w-full' : ''} ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
          {editing ? (
            <>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(12, draft.split('\n').length + 1)}
                className="w-full resize-none bg-transparent outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={saveEdit} className="rounded-full bg-fg/15 px-3 py-1 text-xs">
                  Сохранить
                </button>
                <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-xs opacity-70">
                  Отмена
                </button>
              </div>
            </>
          ) : streaming ? (
            text ? (
              <div className="caret whitespace-pre-wrap break-words">{text}</div>
            ) : (
              <StatusLine />
            )
          ) : isUser ? (
            <>
              {m.attachments && m.attachments.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${text ? 'mb-2' : ''}`}>
                  {m.attachments.map((a) =>
                    a.kind === 'image' ? (
                      <img key={a.id} src={dataUrl(a)} alt={a.name} className="max-h-48 max-w-full rounded-xl object-cover" />
                    ) : (
                      <span key={a.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1 text-xs">
                        <Icon name="file" size={14} className="shrink-0" />
                        <span className="truncate">{a.name}</span>
                      </span>
                    ),
                  )}
                </div>
              )}
              {text && <div className="whitespace-pre-wrap break-words">{text}</div>}
            </>
          ) : (
            text ? <Markdown text={text} /> : <span className="text-xs italic opacity-60">обновил виджет</span>
          )}
        </div>

        {!streaming && !editing && (
          <div className={`mt-1 flex max-w-full flex-wrap items-center gap-x-1 text-xs text-zinc-500 ${isUser ? 'justify-end' : ''}`}>
            {!isUser && count > 1 && (
              <>
                <button disabled={busy || idx <= 0} onClick={() => swipe(id, -1)} className="p-1 enabled:hover:text-zinc-200 disabled:opacity-30" aria-label="Предыдущий вариант">
                  <Icon name="left" size={14} />
                </button>
                <span>
                  {idx + 1}/{count}
                </span>
                <button disabled={busy || idx >= count - 1} onClick={() => swipe(id, 1)} className="p-1 enabled:hover:text-zinc-200 disabled:opacity-30" aria-label="Следующий вариант">
                  <Icon name="right" size={14} />
                </button>
              </>
            )}
            {!isUser && m.stats && <StatsLine s={m.stats} />}
            {!isLast && (
              <button onClick={() => setShowMore((v) => !v)} className="rounded p-1 hover:text-zinc-200" aria-label="Действия">
                <Icon name="more" size={16} />
              </button>
            )}
          </div>
        )}

        {showActions && (
          <div className="anim-fade mt-1 flex flex-wrap gap-1.5">
            {isLast && !isUser && (
              <>
                <Chip icon="refresh" label="Заново" disabled={busy} onClick={() => void regenerate()} />
                <Chip icon="edit" label="С пожеланием" disabled={busy} onClick={() => setWish(wish === null ? '' : null)} />
              </>
            )}
            {isLast && isUser && <Chip icon="refresh" label="Ответить" disabled={busy} onClick={() => void retry()} />}
            <Chip icon={copied ? 'check' : 'copy'} label={copied ? 'Скопировано' : 'Копировать'} onClick={() => void copy()} />
            {isLast && !isUser && <Chip icon="forward" label="Продолжить" disabled={busy} onClick={() => void continueMessage(id)} />}
            <Chip icon="chat" label="Ветка" disabled={busy} onClick={() => void forkFrom(id)} />
            <Chip
              icon="edit"
              label="Править"
              disabled={busy}
              onClick={() => {
                setDraft(m.content);
                setEditing(true);
                setShowMore(false);
              }}
            />
            <Chip
              icon="trash"
              label="Удалить"
              danger
              disabled={busy}
              onClick={() => {
                if (confirm('Удалить это сообщение и всё, что идёт после него в этой ветке?')) void deleteMessage(id);
              }}
            />
          </div>
        )}

        {wish !== null && showActions && (
          <form
            className="anim-fade mt-2 flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void regenerate(wish);
              setWish(null);
            }}
          >
            <input
              autoFocus
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="Что изменить в ответе?"
              className="field min-w-0 flex-1 rounded-full px-4 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
            <button type="submit" disabled={!wish.trim()} className="btn-accent rounded-full px-4 text-sm disabled:opacity-30">
              Ок
            </button>
          </form>
        )}
      </div>
    </div>
  );
});
