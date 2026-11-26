import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useTheme } from '../store/theme';
import { widgetHtml } from '../widgets/html';
import { WIDGETS, foldWidgets, type WidgetId } from '../widgets/registry';

const rgb = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ' ')})`;

/** Цвета приложения для виджета, чтобы он выглядел как часть интерфейса. */
function readTheme() {
  return {
    bg: rgb('--z-950'),
    fg: rgb('--z-50'),
    muted: rgb('--z-400'),
    card: rgb('--z-900'),
    line: rgb('--z-800'),
    accent: rgb('--accent-rgb'),
    'on-accent': rgb('--on-accent'),
  };
}

/**
 * Виджет в изолированном iframe (sandbox без allow-same-origin): у него нет доступа к приложению,
 * ключам и базе. Общение только через postMessage.
 */
function WidgetFrame({ id, state, busy, onSend }: { id: WidgetId; state: unknown; busy: boolean; onSend: (text: string, ops: never[]) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const srcDoc = useMemo(() => widgetHtml(id), [id]);
  const latest = useRef({ state, busy });
  latest.current = { state, busy };
  const themeVersion = useTheme((t) => `${t.mode}${t.accent}`);

  const push = () => ref.current?.contentWindow?.postMessage({ eq: 1, state: latest.current.state, busy: latest.current.busy, theme: readTheme() }, '*');

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data;
      if (!d || d.eq !== 1) return;
      if (d.type === 'ready') push();
      else if (d.type === 'resize' && typeof d.h === 'number') setHeight(Math.min(Math.max(d.h, 40), 420));
      else if (d.type === 'send' && typeof d.text === 'string') onSend(d.text, Array.isArray(d.ops) ? d.ops : []);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(push, [state, busy, themeVersion]);

  return (
    <iframe
      ref={ref}
      title={id}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ height, colorScheme: 'normal' }}
      className="w-full border-0 bg-transparent transition-[height] duration-200"
    />
  );
}

/** Панель виджетов над полем ввода. Показывается, если в чате включён хотя бы один виджет и панель открыта. */
export function WidgetDock() {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const messages = useChat((s) => s.messages);
  const path = useChat((s) => s.path);
  const busy = useChat((s) => s.streamingId !== null);
  const send = useChat((s) => s.send);
  const enabled = (chat?.widgets ?? []).filter((id): id is WidgetId => WIDGETS.some((w) => w.id === id));
  const [tab, setTab] = useState<WidgetId | null>(null);

  const states = useMemo(
    () => (enabled.length ? foldWidgets(path.map((id) => messages[id]).filter(Boolean)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled.join(','), path, messages],
  );

  if (!chat || !states || !enabled.length || !chat.widgetsOpen) return null;
  const active = tab && enabled.includes(tab) ? tab : enabled[0];

  return (
    <div className="glass anim-fade border-t border-fg/5 px-3 pt-2">
      {enabled.length > 1 && (
        <div className="mb-1 flex gap-1.5">
          {enabled.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${id === active ? 'bg-fg text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}
            >
              {WIDGETS.find((w) => w.id === id)?.name}
            </button>
          ))}
        </div>
      )}
      <WidgetFrame
        key={active}
        id={active}
        state={states[active]}
        busy={busy}
        onSend={(text, ops) => void send(text, undefined, ops)}
      />
    </div>
  );
}
