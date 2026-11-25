import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';
import { MessageItem } from './MessageItem';

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

/** Приветствие на пустом чате. */
function EmptyState() {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-8">
      <h2 className="anim-rise font-display text-3xl font-semibold tracking-tight">{greeting()}</h2>
      <p className="anim-rise mt-2 text-zinc-400" style={{ animationDelay: '150ms' }}>
        С чего начнём?
      </p>
    </div>
  );
}

/**
 * Виртуальный список: в DOM находятся только видимые сообщения (+ небольшой запас),
 * поэтому 5000 и 50 сообщений стоят одинаково. Высоты измеряются автоматически.
 */
export function ChatView() {
  const path = useChat((s) => s.path);
  const chatId = useChat((s) => s.chatId);
  const parentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // "прилипли" к низу — автоскролл при стриминге

  const virtualizer = useVirtualizer({
    count: path.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 6,
    getItemKey: (i) => path[i],
  });

  const total = virtualizer.getTotalSize();

  // Автоскролл вниз, пока пользователь сам не пролистал вверх
  useEffect(() => {
    const el = parentRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [total, path.length]);

  // При смене чата — сразу вниз
  useEffect(() => {
    stick.current = true;
  }, [chatId]);

  const onScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <div ref={parentRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
      {path.length === 0 && <EmptyState />}
      <div style={{ height: total, position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}
          >
            <MessageItem id={path[v.index]} isLast={v.index === path.length - 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
