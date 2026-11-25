import { useState } from 'react';
import { PROVIDER_LABEL } from '../guides';
import { useChat } from '../store/chat';
import { resolveProvider } from '../store/resolve';
import { useSettings } from '../store/settings';
import { Icon } from './Icon';

/**
 * Шапка чата: название (нажми, чтобы переименовать), под ним провайдер и модель
 * (нажми, чтобы выбрать другие только для этого чата), справа новый чат и настройки чата.
 */
export function ChatHeader({
  onMenu,
  onModel,
  onSettings,
}: {
  onMenu: () => void;
  onModel: () => void;
  onSettings: () => void;
}) {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const renameChat = useChat((s) => s.renameChat);
  const newChat = useChat((s) => s.newChat);
  const providers = useSettings((s) => s.providers);
  const activeProvider = useSettings((s) => s.activeProvider);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const cfg = chat ? resolveProvider(chat, { providers, activeProvider }) : null;
  const subtitle = cfg ? `${PROVIDER_LABEL[cfg.id]} · ${cfg.model || 'модель не выбрана'}` : '';

  const start = () => {
    if (!chat) return;
    setDraft(chat.title);
    setEditing(true);
  };
  const commit = () => {
    if (!editing || !chat) return;
    setEditing(false);
    if (draft.trim() && draft.trim() !== chat.title) void renameChat(chat.id, draft);
  };

  return (
    <header className="glass relative z-20 flex items-center gap-1 border-b border-fg/5 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button onClick={onMenu} className="rounded-xl p-2 text-zinc-300 md:hidden" aria-label="Чаты">
        <Icon name="menu" />
      </button>

      <div className="min-w-0 flex-1 px-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-full border-b border-fg/30 bg-transparent font-display text-[15px] font-semibold outline-none"
          />
        ) : (
          <button
            onClick={start}
            className="block max-w-full truncate text-left font-display text-[15px] font-semibold"
            title="Нажми, чтобы переименовать"
          >
            {chat?.title ?? ''}
          </button>
        )}
        <button onClick={onModel} className="flex max-w-full items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200">
          <span className="truncate">{subtitle}</span>
          <Icon name="down" size={14} className="shrink-0" />
        </button>
      </div>

      <button onClick={() => void newChat()} className="rounded-xl p-2 text-zinc-300 transition-colors hover:bg-fg/5" aria-label="Новый чат">
        <Icon name="plus" />
      </button>
      <button onClick={onSettings} className="rounded-xl p-2 text-zinc-300 transition-colors hover:bg-fg/5" aria-label="Настройки чата">
        <Icon name="right" />
      </button>
    </header>
  );
}
