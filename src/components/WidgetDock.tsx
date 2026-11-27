import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '../lib/overlay';
import { useChat } from '../store/chat';
import { FRAME_WIDGETS, WIDGETS, type PhoneState, type WidgetId, type WidgetStates } from '../widgets/registry';
import { useWidgets } from '../widgets/useStates';
import { Icon } from './Icon';
import { DiceWidget } from './widgets/DiceWidget';
import { PhoneWidget } from './widgets/PhoneWidget';

type PanelId = Exclude<WidgetId, 'status'>;

/** Короткая строка для свёрнутой панели: что сейчас происходит в виджетах. */
function peekText(enabled: PanelId[], st: WidgetStates): { text: string; hot: boolean } {
  if (enabled.includes('roll') && st.roll.pending) return { text: `Нужен бросок ${st.roll.pending.d}${st.roll.pending.reason ? `: ${st.roll.pending.reason}` : ''}`, hot: true };
  if (enabled.includes('phone')) {
    const last = st.phone.order[st.phone.order.length - 1];
    const m = last ? st.phone.threads[last].slice(-1)[0] : undefined;
    if (m) return { text: `${m.from === 'me' ? 'Ты' : last}: ${m.text}`, hot: m.from === 'them' };
  }
  return { text: enabled.includes('phone') ? 'Телефон' : 'Кубики', hot: false };
}

interface PhoneProps {
  state: PhoneState;
  busy: boolean;
  contact: string | null;
  onContact: (c: string) => void;
}

/** Телефон, подключённый к чату: сообщения уходят в чат без запроса к модели. */
function ConnectedPhone({ full, ...p }: PhoneProps & { full?: boolean }) {
  const send = useChat((s) => s.send);
  const retry = useChat((s) => s.retry);
  const pending = useChat((s) => {
    let n = 0;
    for (let i = s.path.length - 1; i >= 0 && s.messages[s.path[i]]?.role === 'user'; i--) n++;
    return n;
  });
  return (
    <PhoneWidget
      {...p}
      full={full}
      pending={pending}
      onSend={(to, text) => void send(`📱 Сообщение для ${to}: ${text}`, undefined, [{ w: 'phone', t: 'msg', to, text }], { reply: false })}
      onAsk={() => void retry()}
    />
  );
}

/** Телефон на весь экран. Закрывается кнопкой или жестом «назад». */
function PhoneFull({ onClose: onCloseProp, ...p }: PhoneProps & { onClose: () => void }) {
  const { closing, close } = useOverlay(onCloseProp);
  return createPortal(
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[45] flex flex-col bg-zinc-950`}>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Свернуть телефон">
            <Icon name="left" />
          </button>
          <h2 className="font-display text-lg font-semibold">Телефон</h2>
        </div>
        <div className="min-h-0 flex-1 rounded-3xl border border-fg/10 bg-zinc-900/60 p-3">
          <ConnectedPhone {...p} full />
        </div>
      </div>
    </div>,
    document.body,
  );
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
  const enabled = all.filter((id): id is PanelId => FRAME_WIDGETS.includes(id));
  const [tab, setTab] = useState<PanelId | null>(null);
  const [full, setFull] = useState(false);
  const [contact, setContact] = useState<string | null>(null);

  if (!chat || !states || !enabled.length) return null;
  const active = tab && enabled.includes(tab) ? tab : enabled[0];
  const setOpen = (v: boolean) => void updateChat(chat.id, { widgetsOpen: v });
  const phoneProps: PhoneProps = { state: states.phone, busy, contact, onContact: setContact };

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
    <div className="glass anim-fade border-t border-fg/5 px-3 pb-2 pt-2">
      <div className="mb-2 flex items-center gap-1.5">
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
        <span className="ml-auto" />
        {active === 'phone' && (
          <button onClick={() => setFull(true)} className="rounded-lg p-1 text-zinc-500" aria-label="Развернуть телефон на весь экран">
            <Icon name="expand" size={18} />
          </button>
        )}
        <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-zinc-500" aria-label="Свернуть виджеты">
          <Icon name="down" size={18} />
        </button>
      </div>
      <div className="max-h-[42dvh] overflow-y-auto">
        {active === 'phone' ? (
          !full && <ConnectedPhone {...phoneProps} />
        ) : (
          <DiceWidget state={states.roll} busy={busy} onRoll={(text, ops) => void send(text, undefined, ops)} />
        )}
      </div>
      {full && active === 'phone' && <PhoneFull {...phoneProps} onClose={() => setFull(false)} />}
    </div>
  );
}
