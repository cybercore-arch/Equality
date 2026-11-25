import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ROOT, useChat } from '../store/chat';

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? '').replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className ?? '')?.[1];
  const isBlock = !!lang || text.includes('\n');
  if (!isBlock) return <code>{children}</code>;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
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
      <pre className="overflow-x-auto p-3 text-sm">
        <code>{text}</code>
      </pre>
    </div>
  );
}

const STAGES = [
  { from: 0, label: 'Читает' },
  { from: 1500, label: 'Думает' },
  { from: 6000, label: 'Всё ещё думает' },
  { from: 20000, label: 'Модель отвечает долго' },
];

/** Пока ответа нет: пульсирующие точки и стадия, которая меняется со временем. */
function StatusLine() {
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
      <span key={i} className="shimmer anim-fade text-sm">
        {STAGES[i].label}
      </span>
    </div>
  );
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock, pre: ({ children }) => <>{children}</> }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

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
  // Анимируем только свежие сообщения, а не те, что появились при прокрутке старой истории
  const fresh = useRef(m ? Date.now() - m.createdAt < 1500 : false).current;

  if (!m) return null;
  const isUser = m.role === 'user';
  const streaming = streamText !== null;
  const text = streaming ? streamText : m.content;
  const idx = sibs ? sibs.indexOf(id) : 0;
  const count = sibs?.length ?? 1;

  return (
    <div className={`flex px-3 py-1.5 ${isUser ? 'justify-end' : 'justify-start'} ${fresh ? 'anim-msg' : ''}`}>
      <div className={`max-w-[92%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`bubble px-3.5 py-2 leading-relaxed ${isUser ? 'bubble-user' : 'bubble-ai'}`}
        >
          {streaming ? (
            text ? (
              <div className="caret whitespace-pre-wrap break-words">{text}</div>
            ) : (
              <StatusLine />
            )
          ) : isUser ? (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          ) : (
            <Markdown text={text} />
          )}
        </div>

        {!isUser && !streaming && (
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            {count > 1 && (
              <>
                <button disabled={busy || idx <= 0} onClick={() => swipe(id, -1)} className="px-1.5 py-0.5 enabled:hover:text-zinc-200 disabled:opacity-30">
                  ◀
                </button>
                <span>
                  {idx + 1}/{count}
                </span>
                <button disabled={busy || idx >= count - 1} onClick={() => swipe(id, 1)} className="px-1.5 py-0.5 enabled:hover:text-zinc-200 disabled:opacity-30">
                  ▶
                </button>
              </>
            )}
            {isLast && (
              <button disabled={busy} onClick={regenerate} className="px-1.5 py-0.5 enabled:hover:text-zinc-200 disabled:opacity-30" title="Другой вариант ответа">
                ⟳
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
