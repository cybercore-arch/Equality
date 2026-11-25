import { useRef, useState } from 'react';
import { useChat } from '../store/chat';

export function Composer() {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const busy = useChat((s) => s.streamingId !== null);
  const error = useChat((s) => s.error);
  const clearError = useChat((s) => s.clearError);

  const submit = () => {
    if (!text.trim() || busy) return;
    const value = text;
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
    void send(value);
  };

  return (
    <div className="glass border-t border-fg/5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">
          <span className="flex-1 break-words">{error}</span>
          <button onClick={clearError} className="text-red-300">
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder="Сообщение…"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
          }}
          onKeyDown={(e) => {
            // На ПК Enter отправляет, Shift+Enter — новая строка. На телефоне — кнопка.
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-[42px] flex-1 resize-none field rounded-2xl px-4 py-2.5 text-[15px] outline-none placeholder:text-zinc-500"
        />
        {busy ? (
          <button onClick={stop} className="h-[42px] rounded-2xl bg-zinc-700 px-4 text-sm">
            Стоп
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="btn-accent h-[42px] rounded-2xl px-4 text-sm font-medium disabled:opacity-40"
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
}
