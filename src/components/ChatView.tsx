import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useRp } from '../store/rp';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { CharactersScreen } from './CharactersScreen';
import { Wizard } from './Wizard';
import { MessageItem } from './MessageItem';
import { ModePicker } from './ModePicker';

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

/** Пустой чат: приветствие и аккуратный выбор режима (только пока в чате нет сообщений). */
function EmptyState() {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const setChatMode = useChat((s) => s.setChatMode);
  const start = useChat((s) => s.startWithCharacter);
  const characters = useRp((s) => s.characters);
  const [library, setLibrary] = useState(false);
  const [wizard, setWizard] = useState(false);
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-8">
      <h2 className="anim-rise font-display text-3xl font-semibold tracking-tight">{greeting()}</h2>
      <p className="anim-rise mt-2 text-zinc-400" style={{ animationDelay: '150ms' }}>
        С чего начнём?
      </p>
      {chat && (
        <div className="anim-rise mt-7" style={{ animationDelay: '300ms' }}>
          <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Режим</div>
          <ModePicker value={chat.modeId ?? 'general'} onChange={(id) => void setChatMode(chat.id, id)} />
        </div>
      )}
      {chat?.modeId === 'rp' && (
        <div className="anim-rise mt-6">
          <button onClick={() => setWizard(true)} className="mb-4 w-full rounded-2xl border border-fg/20 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-fg/5">
            Не знаю, с чего начать
          </button>
          <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Персонаж</div>
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2">
            {characters.map((c) => (
              <button key={c.id} onClick={() => void start(c.id)} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
                <Avatar src={c.avatar} name={c.name} size={64} />
                <span className="w-full truncate text-xs text-zinc-300">{c.name}</span>
              </button>
            ))}
            <button onClick={() => setLibrary(true)} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-zinc-600 text-zinc-400">+</span>
              <span className="text-xs text-zinc-400">{characters.length ? 'Все' : 'Создать'}</span>
            </button>
          </div>
          {characters.length === 0 && (
            <p className="text-xs text-zinc-500">Создай персонажа или импортируй готовую карточку. Можно и без персонажа: просто пиши, о чём играть.</p>
          )}
        </div>
      )}
      {wizard && <Wizard onClose={() => setWizard(false)} />}
      {library && <CharactersScreen onClose={() => setLibrary(false)} onPick={(id) => void start(id)} />}
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
  const [away, setAway] = useState(false); // ушли далеко вверх: показываем кнопку «вниз»

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
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = dist < 80;
    const far = dist > el.clientHeight * 1.5;
    setAway((a) => (a === far ? a : far));
  };

  const toBottom = () => {
    const el = parentRef.current;
    if (!el || !path.length) return;
    stick.current = true;
    virtualizer.scrollToIndex(path.length - 1, { align: 'end' });
    // Высоты ещё не измерены: после прыжка дотягиваем до самого низа
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
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
    {away && (
      <button
        onClick={toBottom}
        aria-label="В самый низ"
        className="glass anim-fade absolute bottom-3 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-fg/10 text-zinc-200 shadow-lg"
      >
        <Icon name="down" size={20} />
      </button>
    )}
    </div>
  );
}
