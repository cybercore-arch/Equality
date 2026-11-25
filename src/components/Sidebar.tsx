import { useChat } from '../store/chat';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chats = useChat((s) => s.chats);
  const chatId = useChat((s) => s.chatId);
  const newChat = useChat((s) => s.newChat);
  const selectChat = useChat((s) => s.selectChat);
  const deleteChat = useChat((s) => s.deleteChat);

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col glass border-r border-fg/5 pt-[env(safe-area-inset-top)] transition-transform md:relative md:z-10 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => {
            void newChat();
            onClose();
          }}
          className="btn-accent m-3 rounded-xl py-2 text-sm font-medium"
        >
          + Новый чат
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg ${c.id === chatId ? 'bg-fg/10' : 'hover:bg-fg/5'}`}
            >
              <button
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                onClick={() => {
                  void selectChat(c.id);
                  onClose();
                }}
              >
                {c.title}
              </button>
              <button
                className="px-2 text-zinc-500 hover:text-red-400"
                title="Удалить чат"
                onClick={() => {
                  if (confirm('Удалить чат целиком?')) void deleteChat(c.id);
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
