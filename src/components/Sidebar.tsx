import { useState } from 'react';
import { useChat } from '../store/chat';
import type { Chat, Folder } from '../types';
import { Icon } from './Icon';

/**
 * Левое меню: папки и список чатов. У каждого чата и папки кнопка «⋯»:
 * переименовать, переместить в папку, удалить. Внизу кнопка настроек приложения.
 */
export function Sidebar({
  open,
  onClose,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
}) {
  const chats = useChat((s) => s.chats);
  const folders = useChat((s) => s.folders);
  const chatId = useChat((s) => s.chatId);
  const newChat = useChat((s) => s.newChat);
  const selectChat = useChat((s) => s.selectChat);
  const deleteChat = useChat((s) => s.deleteChat);
  const renameChat = useChat((s) => s.renameChat);
  const updateChat = useChat((s) => s.updateChat);
  const createFolder = useChat((s) => s.createFolder);
  const renameFolder = useChat((s) => s.renameFolder);
  const toggleFolder = useChat((s) => s.toggleFolder);
  const deleteFolder = useChat((s) => s.deleteFolder);

  /** Ключ строки с раскрытыми действиями: "chat:ID" или "folder:ID" */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);

  const folderIds = new Set(folders.map((f) => f.id));
  const loose = chats.filter((c) => !c.folderId || !folderIds.has(c.folderId));

  const startRename = (key: string, current: string) => {
    setDraft(current);
    setRenaming(key);
    setMenuFor(null);
  };

  const commitRename = (key: string) => {
    if (renaming !== key) return;
    setRenaming(null);
    const [type, id] = key.split(':');
    if (!draft.trim()) return;
    if (type === 'chat') void renameChat(id, draft);
    else void renameFolder(id, draft);
  };

  // Обычная функция, а не компонент: иначе поле пересоздавалось бы на каждую букву и теряло фокус
  const renameInput = (k: string) => (
    <input
      autoFocus
      value={draft}
      maxLength={80}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commitRename(k)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename(k);
        if (e.key === 'Escape') setRenaming(null);
      }}
      className="min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none"
    />
  );

  const ActionBtn = ({ icon, label, onClick, danger }: { icon: 'edit' | 'folder' | 'trash'; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-700 ${
        danger ? 'text-red-300' : 'text-zinc-300'
      }`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );

  const chatRow = (c: Chat, indent: boolean) => {
    const key = `chat:${c.id}`;
    const active = c.id === chatId;
    return (
      <div key={c.id} className={indent ? 'ml-3' : ''}>
        <div className={`flex items-center rounded-xl transition-colors ${active ? 'bg-fg/10' : 'hover:bg-fg/5'}`}>
          {renaming === key ? (
            <div className="flex min-w-0 flex-1 p-1">
              {renameInput(key)}
            </div>
          ) : (
            <button
              className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
              onClick={() => {
                void selectChat(c.id);
                onClose();
              }}
            >
              {c.title}
            </button>
          )}
          <button
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-200"
            aria-label="Действия с чатом"
            onClick={() => {
              setMenuFor(menuFor === key ? null : key);
              setMoving(null);
            }}
          >
            <Icon name="more" size={18} />
          </button>
        </div>

        {menuFor === key && (
          <div className="anim-fade flex flex-wrap gap-1.5 px-2 py-2">
            <ActionBtn icon="edit" label="Переименовать" onClick={() => startRename(key, c.title)} />
            <ActionBtn icon="folder" label="В папку" onClick={() => setMoving(moving === c.id ? null : c.id)} />
            <ActionBtn
              icon="trash"
              label="Удалить"
              danger
              onClick={() => {
                if (confirm('Удалить чат целиком?')) void deleteChat(c.id);
              }}
            />
          </div>
        )}

        {menuFor === key && moving === c.id && (
          <div className="anim-fade mx-2 mb-2 rounded-xl bg-zinc-800/60 p-1">
            {[{ id: null, name: 'Без папки' } as { id: string | null; name: string }, ...folders].map((f) => (
              <button
                key={f.id ?? 'none'}
                onClick={() => {
                  void updateChat(c.id, { folderId: f.id });
                  setMenuFor(null);
                  setMoving(null);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-700 ${
                  (c.folderId ?? null) === f.id ? 'text-zinc-50' : 'text-zinc-400'
                }`}
              >
                {f.name}
              </button>
            ))}
            {folders.length === 0 && <div className="px-3 py-2 text-xs text-zinc-500">Папок пока нет, создай кнопкой «Папка» выше.</div>}
          </div>
        )}
      </div>
    );
  };

  const folderBlock = (f: Folder) => {
    const key = `folder:${f.id}`;
    const inside = chats.filter((c) => c.folderId === f.id);
    return (
      <div key={f.id} className="mb-1">
        <div className="flex items-center rounded-xl hover:bg-fg/5">
          {renaming === key ? (
            <div className="flex min-w-0 flex-1 p-1">
              {renameInput(key)}
            </div>
          ) : (
            <button onClick={() => void toggleFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm">
              <Icon name="right" size={14} className={`shrink-0 text-zinc-500 transition-transform duration-200 ${f.collapsed ? '' : 'rotate-90'}`} />
              <Icon name="folder" size={16} className="shrink-0 text-zinc-400" />
              <span className="truncate">{f.name}</span>
              <span className="text-xs text-zinc-600">{inside.length}</span>
            </button>
          )}
          <button
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-200"
            aria-label="Действия с папкой"
            onClick={() => setMenuFor(menuFor === key ? null : key)}
          >
            <Icon name="more" size={18} />
          </button>
        </div>
        {menuFor === key && (
          <div className="anim-fade flex flex-wrap gap-1.5 px-2 py-2">
            <ActionBtn icon="edit" label="Переименовать" onClick={() => startRename(key, f.name)} />
            <ActionBtn
              icon="trash"
              label="Удалить папку"
              danger
              onClick={() => {
                if (confirm('Удалить папку? Чаты из неё останутся в общем списке.')) void deleteFolder(f.id);
              }}
            />
          </div>
        )}
        {!f.collapsed && inside.map((c) => chatRow(c, true))}
      </div>
    );
  };

  return (
    <>
      {open && <div className="anim-fade fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}
      <aside
        className={`glass fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-fg/5 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-out md:relative md:z-10 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <img src="./favicon.svg" alt="" className="h-6 w-6 rounded-md" />
          <span className="font-display text-sm font-semibold tracking-wide">Equality</span>
        </div>

        <div className="flex gap-2 p-3">
          <button
            onClick={() => {
              void newChat();
              onClose();
            }}
            className="btn-accent flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium"
          >
            <Icon name="plus" size={16} />
            Новый чат
          </button>
          <button
            onClick={() => {
              setAddingFolder(true);
              setDraft('');
            }}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            <Icon name="folder" size={16} />
            Папка
          </button>
        </div>

        {addingFolder && (
          <div className="anim-fade mx-3 mb-2 flex gap-2">
            <input
              autoFocus
              value={draft}
              maxLength={40}
              placeholder="Название папки"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (draft.trim()) void createFolder(draft);
                  setAddingFolder(false);
                }
                if (e.key === 'Escape') setAddingFolder(false);
              }}
              onBlur={() => setAddingFolder(false)}
              className="min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {folders.map(folderBlock)}
          {loose.map((c) => chatRow(c, false))}
        </div>

        <button
          onClick={() => {
            onSettings();
            onClose();
          }}
          className="flex items-center gap-2 border-t border-fg/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-zinc-300 transition-colors hover:bg-fg/5"
        >
          <Icon name="sliders" size={18} />
          Настройки
        </button>
      </aside>
    </>
  );
}
