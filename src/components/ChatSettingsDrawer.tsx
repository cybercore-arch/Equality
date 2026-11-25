import { useChat } from '../store/chat';
import { Icon } from './Icon';
import { ModePicker } from './ModePicker';

/**
 * Правая панель настроек чата. Сейчас в ней смена режима,
 * дальше (Этап 3B) здесь появятся температура, системный промпт, счётчик токенов и суммаризация.
 */
export function ChatSettingsDrawer({ onClose }: { onClose: () => void }) {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const setChatMode = useChat((s) => s.setChatMode);
  if (!chat) return null;

  return (
    <div className="anim-fade fixed inset-0 z-40 bg-black/50" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="anim-drawer absolute inset-y-0 right-0 flex w-[min(22rem,92vw)] flex-col overflow-y-auto border-l border-fg/10 bg-zinc-900 px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <div className="mb-4 flex items-center gap-2">
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-300" aria-label="Закрыть">
            <Icon name="right" />
          </button>
          <h2 className="font-display text-lg font-semibold">Настройки чата</h2>
        </div>

        <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Режим</div>
        <ModePicker value={chat.modeId ?? 'general'} onChange={(id) => void setChatMode(chat.id, id)} />

        <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
          Скоро здесь: температура и другие параметры, системный промпт, счётчик токенов контекста и кнопка
          «сжать контекст».
        </div>
      </aside>
    </div>
  );
}
