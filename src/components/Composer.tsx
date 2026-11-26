import { useRef, useState } from 'react';
import { dataUrl, readAttachment } from '../lib/attachments';
import { supportsImages } from '../lib/vision';
import { useChat } from '../store/chat';
import { resolveProvider } from '../store/resolve';
import { useSettings } from '../store/settings';
import type { Attachment } from '../types';
import { Icon } from './Icon';

export function Composer() {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const settings = useSettings();
  const provider = chat ? resolveProvider(chat, settings) : undefined;
  const hasImages = files.some((f) => f.kind === 'image');
  const noVision = hasImages && !!provider && !supportsImages(provider.id, provider.model);
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const busy = useChat((s) => s.streamingId !== null);
  const error = useChat((s) => s.error);
  const clearError = useChat((s) => s.clearError);
  const retry = useChat((s) => s.retry);
  const canRetry = useChat((s) => s.messages[s.path[s.path.length - 1]]?.role === 'user');

  const submit = () => {
    if ((!text.trim() && !files.length) || busy) return;
    const value = text;
    const attached = files;
    setText('');
    setFiles([]);
    setFileError('');
    if (ref.current) ref.current.style.height = 'auto';
    void send(value, attached);
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const errors: string[] = [];
    const added: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (files.length + added.length >= 8) {
        errors.push('Не больше 8 файлов в одном сообщении');
        break;
      }
      try {
        added.push(await readAttachment(f));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (added.length) setFiles((prev) => [...prev, ...added]);
    setFileError(errors.join('\n'));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="glass border-t border-fg/5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{error}</span>
          {canRetry && (
            <button
              onClick={() => {
                clearError();
                void retry();
              }}
              className="shrink-0 rounded-md bg-red-900/70 px-2 py-0.5 text-xs text-red-100"
            >
              Повторить
            </button>
          )}
          <button onClick={clearError} className="text-red-300">
            ✕
          </button>
        </div>
      )}
      {fileError && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{fileError}</span>
          <button onClick={() => setFileError('')} aria-label="Закрыть">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {noVision && (
        <div className="mb-2 rounded-lg bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
          Похоже, модель «{provider?.model}» не умеет читать картинки. Фото уйдёт, но она может проигнорировать его или ответить
          ошибкой. Выбери другую модель (например, Gemini или с пометкой vision) либо убери фото.
        </div>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {files.map((f) => (
            <div key={f.id} className="anim-fade relative flex h-14 shrink-0 items-center gap-2 rounded-xl bg-zinc-800 pr-3 text-xs">
              {f.kind === 'image' ? (
                <img src={dataUrl(f)} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <Icon name="file" size={18} className="ml-3 shrink-0 text-zinc-400" />
              )}
              <span className="max-w-[9rem] truncate text-zinc-300">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-700 p-0.5 text-zinc-200"
                aria-label="Убрать"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl text-zinc-400 disabled:opacity-40"
          aria-label="Прикрепить файл или фото"
        >
          <Icon name="clip" />
        </button>
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
          <button onClick={stop} className="flex h-[42px] w-[46px] items-center justify-center rounded-2xl bg-zinc-700" aria-label="Остановить">
            <Icon name="stop" size={18} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim() && !files.length}
            className="btn-accent flex h-[42px] w-[46px] items-center justify-center rounded-2xl disabled:opacity-40"
            aria-label="Отправить"
          >
            <Icon name="send" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
