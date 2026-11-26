import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useWidgets } from '../widgets/useStates';
import { Icon } from './Icon';
import { useTheme } from '../store/theme';
import { widgetHtml } from '../widgets/html';
import { FRAME_WIDGETS, WIDGETS, type WidgetId } from '../widgets/registry';

type FrameId = Exclude<WidgetId, 'status'>;

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
function WidgetFrame({ id, state, busy, onSend }: { id: FrameId; state: unknown; busy: boolean; onSend: (text: string, ops: never[]) => void }) {
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

/** Короткая строка-подсказка для свёрнутой панели: что сейчас происходит в виджетах. */
function peekText(enabled: FrameId[], st: NonNullable<ReturnType<typeof useWidgets>['states']>): { text: string; hot: boolean } {
  if (enabled.includes('roll') && st.roll.pending) return { text: `Нужен бросок ${st.roll.pending.d}${st.roll.pending.reason ? `: ${st.roll.pending.reason}` : ''}`, hot: true };
  if (enabled.includes('phone')) {
    const last = st.phone.order[st.phone.order.length - 1];
    const m = last ? st.phone.threads[last].slice(-1)[0] : undefined;
    if (m) return { text: `${m.from === 'me' ? 'Ты' : last}: ${m.text}`, hot: m.from === 'them' };
  }
  return { text: enabled.includes('phone') ? 'Телефон' : 'Кубики', hot: false };
}

/**
 * Панель виджетов над полем ввода. Свёрнута в тонкую строку с последним событием (новое сообщение, запрос броска),
 * по нажатию раскрывается. Статус живёт отдельно, полоской под шапкой.
 */
export function WidgetDock() {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const busy = useChat((s) => s.streamingId !== null);
  const send = useChat((s) => s.send);
  const updateChat = useChat((s) => s.updateChat);
  const { enabled: all, states } = useWidgets();
  const enabled = all.filter((id): id is FrameId => FRAME_WIDGETS.includes(id));
  const [tab, setTab] = useState<FrameId | null>(null);

  if (!chat || !states || !enabled.length) return null;
  const active = tab && enabled.includes(tab) ? tab : enabled[0];
  const setOpen = (v: boolean) => void updateChat(chat.id, { widgetsOpen: v });

  if (!chat.widgetsOpen) {
    const { text, hot } = peekText(enabled, states);
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass anim-fade flex w-full items-center gap-2 border-t border-fg/5 px-4 py-2 text-left text-xs"
        aria-label="Открыть виджеты"
      >
        <Icon name="grid" size={16} className="shrink-0 text-zinc-400" />
        <span className={`min-w-0 flex-1 truncate ${hot ? 'text-zinc-50' : 'text-zinc-400'}`}>{text}</span>
        {hot && <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--accent-rgb))]" />}
        <Icon name="down" size={14} className="shrink-0 rotate-180 text-zinc-500" />
      </button>
    );
  }

  return (
    <div className="glass anim-fade border-t border-fg/5 px-3 pt-2">
      <div className="mb-1 flex items-center gap-1.5">
        {enabled.length > 1 &&
          enabled.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${id === active ? 'bg-fg text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}
            >
              {WIDGETS.find((w) => w.id === id)?.name}
            </button>
          ))}
        <button onClick={() => setOpen(false)} className="ml-auto rounded-lg p-1 text-zinc-500" aria-label="Свернуть виджеты">
          <Icon name="down" size={18} />
        </button>
      </div>
      <div style={{ maxHeight: '42dvh' }} className="overflow-y-auto">
        <WidgetFrame key={active} id={active} state={states[active]} busy={busy} onSend={(text, ops) => void send(text, undefined, ops)} />
      </div>
    </div>
  );
}
