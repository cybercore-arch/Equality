import { useState } from 'react';
import { PROVIDER_LABEL } from '../guides';
import { useChat } from '../store/chat';
import { resolveProvider } from '../store/resolve';
import { useSettings } from '../store/settings';
import type { ProviderKind } from '../types';
import { ModelPicker } from './ModelPicker';

/** Панель, выезжающая сверху: провайдер и модель только для текущего чата. */
export function ModelSheet({ onClose }: { onClose: () => void }) {
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const updateChat = useChat((s) => s.updateChat);
  const providers = useSettings((s) => s.providers);
  const activeProvider = useSettings((s) => s.activeProvider);

  const current = chat ? resolveProvider(chat, { providers, activeProvider }) : null;
  const [pid, setPid] = useState<ProviderKind>(current?.id ?? activeProvider);
  const [model, setModel] = useState(current?.model ?? '');
  const [ctx, setCtx] = useState<number | undefined>(chat?.contextLimit);

  if (!chat) return null;

  const cfg = providers.find((p) => p.id === pid) ?? providers[0];
  const usable = providers.filter((p) => p.apiKey.trim() || (p.id === 'custom' && p.baseUrl?.trim()) || p.id === pid);
  const hasKey = !!cfg.apiKey.trim() || cfg.id === 'custom';

  const choose = (id: ProviderKind) => {
    setPid(id);
    setModel(providers.find((p) => p.id === id)?.model ?? '');
    setCtx(undefined);
  };

  return (
    <div className="anim-fade fixed inset-0 z-40 bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-drop mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-b-3xl border-b border-fg/10 bg-zinc-900 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <h2 className="font-display text-lg font-semibold">Модель для этого чата</h2>
        <p className="mt-1 text-xs text-zinc-500">Меняется только здесь. Остальные чаты используют настройки по умолчанию.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {usable.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200 ${
                p.id === pid ? 'border-fg/70 bg-zinc-800' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {PROVIDER_LABEL[p.id]}
            </button>
          ))}
        </div>
        {!hasKey && (
          <p className="mt-3 text-xs text-red-300">Для этого провайдера нет ключа: добавь его в настройках приложения.</p>
        )}

        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Название модели"
          autoCapitalize="off"
          spellCheck={false}
          className="mt-4 w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
        />
        <ModelPicker
          cfg={{ ...cfg, model }}
          onPick={(id, context) => {
            setModel(id);
            setCtx(context);
          }}
        />

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              void updateChat(chat.id, { providerId: pid, model: model.trim() || undefined, contextLimit: ctx });
              onClose();
            }}
            disabled={!model.trim()}
            className="btn-accent flex-1 rounded-2xl py-2.5 text-sm font-medium disabled:opacity-30"
          >
            Применить
          </button>
          <button
            onClick={() => {
              void updateChat(chat.id, { providerId: undefined, model: undefined, contextLimit: undefined });
              onClose();
            }}
            className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300"
          >
            По умолчанию
          </button>
        </div>
      </div>
    </div>
  );
}
