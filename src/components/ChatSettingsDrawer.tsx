import { useEffect, useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { estimateTokens, formatContext } from '../lib/tokens';
import { getMode } from '../modes';
import { useChat } from '../store/chat';
import { buildContext } from '../store/prompt';
import { useRp } from '../store/rp';
import { useSettings } from '../store/settings';
import { Collapsible } from './Collapsible';
import { Icon } from './Icon';
import { ModePicker } from './ModePicker';

const fmt = (n: number) => n.toLocaleString('ru-RU');

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-fg' : 'bg-zinc-700'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 transition-all duration-200 ${checked ? 'left-[1.1rem]' : 'left-0.5 bg-zinc-400'}`}
      />
    </button>
  );
}

function Param(props: {
  label: string;
  value?: number;
  def: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const { label, value, def, min, max, step, onChange, onReset } = props;
  const shown = Number((value ?? def).toFixed(2));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="flex items-center gap-2">
          <span className={value !== undefined ? 'text-zinc-50' : 'text-zinc-500'}>{shown}</span>
          {value !== undefined && (
            <button onClick={onReset} className="text-xs text-zinc-500 underline underline-offset-2">
              как в режиме ({def})
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent-rgb))]"
      />
    </div>
  );
}

const snippet = (t: string, n = 180) => (t.length > n ? `${t.slice(0, n)}…` : t);

/**
 * Правая панель настроек чата: режим, параметры генерации, слои системного промпта,
 * размер контекста и сжатие старой части переписки.
 */
export function ChatSettingsDrawer({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const chat = useChat((s) => s.chats.find((c) => c.id === s.chatId));
  const messages = useChat((s) => s.messages);
  const path = useChat((s) => s.path);
  const busy = useChat((s) => s.streamingId !== null);
  const summarizing = useChat((s) => s.summarizing);
  const error = useChat((s) => s.error);
  const clearError = useChat((s) => s.clearError);
  const updateChat = useChat((s) => s.updateChat);
  const setChatMode = useChat((s) => s.setChatMode);
  const summarizeContext = useChat((s) => s.summarizeContext);
  const setSummary = useChat((s) => s.setSummary);
  const lorebooks = useRp((s) => s.lorebooks);
  const characters = useRp((s) => s.characters);
  const personas = useRp((s) => s.personas);
  const defaultPersonaId = useSettings((s) => s.defaultPersonaId);
  const globalPrompt = useSettings((s) => s.globalPrompt);
  const searchEnabled = useSettings((s) => s.searchEnabled);

  // Черновики текстовых полей: в базу пишем, когда пользователь закончил ввод
  const [promptDraft, setPromptDraft] = useState(chat?.systemPrompt ?? '');
  const [summaryDraft, setSummaryDraft] = useState(chat?.summary ?? '');
  useEffect(() => setSummaryDraft(chat?.summary ?? ''), [chat?.summary]);

  if (!chat) return null;

  const mode = getMode(chat.modeId ?? 'general');
  const ctx = buildContext({ chat, messages, path, globalPrompt, searchEnabled });
  const estimate = estimateTokens(ctx.system) + ctx.input.reduce((n, m) => n + estimateTokens(m.content), 0);

  // Точный размер контекста: токены запроса и ответа из последнего ответа, где провайдер их прислал
  const lastStats = [...path]
    .reverse()
    .map((id) => messages[id])
    .find((m) => m?.role === 'assistant' && m.stats?.promptTokens !== undefined)?.stats;
  const real = lastStats ? (lastStats.promptTokens ?? 0) + lastStats.tokens : null;

  const limit = chat.contextLimit;
  const used = real ?? estimate;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-40 bg-black/50`} onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? 'anim-drawer-out' : 'anim-drawer'} absolute inset-y-0 right-0 flex w-[min(24rem,94vw)] flex-col overflow-y-auto border-l border-fg/10 bg-zinc-900 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]`}
      >
        <div className="mb-4 flex items-center gap-2">
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-300" aria-label="Закрыть">
            <Icon name="right" />
          </button>
          <h2 className="font-display text-lg font-semibold">Настройки чата</h2>
        </div>

        <div className="space-y-3">
          <Collapsible title="Режим" hint={mode.name}>
            <ModePicker value={chat.modeId ?? 'general'} onChange={(id) => void setChatMode(chat.id, id)} />
          </Collapsible>

          {(chat.modeId === 'rp' || chat.characterId) && (
            <Collapsible
              title="Персонаж и персона"
              hint={`${characters.find((c) => c.id === chat.characterId)?.name ?? 'без персонажа'} · ${
                personas.find((p) => p.id === (chat.personaId ?? defaultPersonaId))?.name ?? 'без персоны'
              }`}
            >
              <label className="block text-sm">
                <span className="text-zinc-300">Персонаж</span>
                <select
                  value={chat.characterId ?? ''}
                  onChange={(e) => void updateChat(chat.id, { characterId: e.target.value || undefined })}
                  className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">Без персонажа</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-300">Персона игрока</span>
                <select
                  value={chat.personaId ?? ''}
                  onChange={(e) => void updateChat(chat.id, { personaId: e.target.value || undefined })}
                  className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">По умолчанию{defaultPersonaId ? '' : ' (не выбрана)'}</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-500">Смена персонажа в середине чата меняет только то, как модель играет дальше. Приветствие не добавляется.</p>
            </Collapsible>
          )}

          <Collapsible
            title="Лорбуки"
            hint={chat.lorebookIds?.length ? `Подключено: ${chat.lorebookIds.filter((id) => lorebooks.some((b) => b.id === id)).length}` : 'не подключены'}
          >
            {lorebooks.length === 0 && <p className="text-xs text-zinc-500">Лорбуков пока нет. Создай их в Настройки → Персонажи и персоны.</p>}
            {lorebooks.map((b) => {
              const on = chat.lorebookIds?.includes(b.id) ?? false;
              return (
                <label key={b.id} className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const cur = chat.lorebookIds ?? [];
                      void updateChat(chat.id, { lorebookIds: on ? cur.filter((x) => x !== b.id) : [...cur, b.id] });
                    }}
                    className="h-4 w-4 accent-[rgb(var(--accent-rgb))]"
                  />
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-zinc-500">{b.entries.length}</span>
                </label>
              );
            })}
            {ctx.loreHits.length > 0 && (
              <p className="text-xs text-zinc-500">В следующем запросе сработали: {ctx.loreHits.join(', ')}</p>
            )}
          </Collapsible>

          <Collapsible title="Параметры" hint={`Температура ${Number(ctx.temperature.toFixed(2))} · Top-P ${Number(ctx.topP.toFixed(2))}`} defaultOpen>
            <Param
              label="Температура"
              value={chat.temperature}
              def={mode.temperature}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => void updateChat(chat.id, { temperature: v })}
              onReset={() => void updateChat(chat.id, { temperature: undefined })}
            />
            <Param
              label="Top-P"
              value={chat.topP}
              def={mode.topP}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(v) => void updateChat(chat.id, { topP: v })}
              onReset={() => void updateChat(chat.id, { topP: undefined })}
            />
            <label className="block text-sm">
              <span className="text-zinc-300">Максимум токенов в ответе</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="по умолчанию у провайдера"
                value={chat.maxTokens ?? ''}
                onChange={(e) =>
                  void updateChat(chat.id, { maxTokens: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : undefined })
                }
                className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
              />
            </label>
            <div className="flex items-start gap-3">
              <Switch checked={ctx.googleSearch} onChange={(v) => void updateChat(chat.id, { search: v })} label="Поиск Google" />
              <div className="min-w-0 text-sm">
                <div className="text-zinc-300">Поиск Google</div>
                <div className="text-xs text-zinc-500">
                  Только для Gemini. На бесплатных ключах часто недоступен.
                  {chat.search !== undefined && (
                    <button onClick={() => void updateChat(chat.id, { search: undefined })} className="ml-1 underline underline-offset-2">
                      как в режиме
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Collapsible>

          <Collapsible title="Системный промпт" hint={ctx.system ? `${fmt(ctx.system.length)} символов` : 'пусто'}>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Switch checked={!chat.noGlobalPrompt} onChange={(v) => void updateChat(chat.id, { noGlobalPrompt: !v })} label="Общий промпт" />
                <div className="min-w-0 text-sm">
                  <div className="text-zinc-300">Общий промпт</div>
                  <div className="whitespace-pre-wrap break-words text-xs text-zinc-500">
                    {globalPrompt.trim() ? snippet(globalPrompt.trim()) : 'Не задан. Добавить: Настройки → Общий системный промпт.'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Switch checked={!chat.noModePrompt} onChange={(v) => void updateChat(chat.id, { noModePrompt: !v })} label="Промпт режима" />
                <div className="min-w-0 text-sm">
                  <div className="text-zinc-300">Промпт режима «{mode.name}»</div>
                  <div className="whitespace-pre-wrap break-words text-xs text-zinc-500">{snippet(mode.systemPrompt, 240)}</div>
                </div>
              </div>
              <label className="block text-sm">
                <span className="text-zinc-300">Промпт этого чата</span>
                <textarea
                  value={promptDraft}
                  rows={5}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  onBlur={() => {
                    const t = promptDraft.trim();
                    if (t !== (chat.systemPrompt ?? '')) void updateChat(chat.id, { systemPrompt: t || undefined });
                  }}
                  placeholder="Например: говори коротко, называй меня по имени…"
                  className="mt-1.5 w-full resize-none rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
                />
              </label>
              <Collapsible title="Что уходит модели" hint="итоговый системный промпт">
                <pre className="whitespace-pre-wrap break-words text-xs text-zinc-400">{ctx.system || '(пусто)'}</pre>
                <div className="text-xs text-zinc-600">Сообщений в запросе: {ctx.input.length}</div>
              </Collapsible>
            </div>
          </Collapsible>

          <Collapsible title="Контекст" hint={`≈ ${fmt(used)} токенов${limit ? ` из ${formatContext(limit)}` : ''}`} defaultOpen>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-semibold">≈ {fmt(estimate)}</span>
                <span className="text-xs text-zinc-500">токенов в следующем запросе</span>
              </div>
              {real !== null && (
                <div className="mt-0.5 text-xs text-zinc-500">По данным провайдера на последний ответ: {fmt(real)}</div>
              )}
              {limit ? (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-700">
                    <div className="h-full rounded-full bg-fg transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {pct}% от {fmt(limit)}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="block text-sm">
              <span className="text-zinc-300">Размер контекста модели</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="подставляется при выборе модели из списка"
                value={chat.contextLimit ?? ''}
                onChange={(e) => void updateChat(chat.id, { contextLimit: e.target.value ? Math.floor(Number(e.target.value)) : undefined })}
                className="mt-1.5 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
              />
            </label>

            <div className="flex items-start gap-3">
              <Switch checked={!chat.noAutoSummary} onChange={(v) => void updateChat(chat.id, { noAutoSummary: !v })} label="Автосжатие" />
              <div className="min-w-0 text-sm">
                <div className="text-zinc-300">Автосжатие в этом чате</div>
                <div className="text-xs text-zinc-500">Когда контекст заполнен на 80%, старая часть сама сожмётся в выжимку. Общий выключатель: Настройки.</div>
              </div>
            </div>

            <div>
              <button
                onClick={() => void summarizeContext()}
                disabled={busy || summarizing}
                className="btn-accent w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40"
              >
                {summarizing ? 'Сжимаю…' : chat.summary ? 'Обновить выжимку' : 'Сжать контекст'}
              </button>
              <p className="mt-2 text-xs text-zinc-500">
                Старые сообщения останутся в чате, но модели вместо них уйдёт короткая выжимка. Шесть последних сообщений
                остаются как есть.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-950/60 px-3 py-2 text-xs text-red-200">
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{error}</span>
                <button onClick={clearError}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            {chat.summary && (
              <div>
                <div className="mb-1 text-xs text-zinc-500">
                  {ctx.summarizedCount > 0
                    ? `Выжимка заменяет ${ctx.summarizedCount} сообщ. Её можно поправить вручную.`
                    : 'Эта выжимка относится к другой ветке чата и сейчас не используется.'}
                </div>
                <textarea
                  value={summaryDraft}
                  rows={7}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  onBlur={() => {
                    if (summaryDraft.trim() !== (chat.summary ?? '')) void setSummary(summaryDraft);
                  }}
                  className="w-full resize-none rounded-xl bg-zinc-800 px-3 py-2 text-xs outline-none"
                />
                <button onClick={() => void setSummary('')} className="mt-1 text-xs text-zinc-500 underline underline-offset-2">
                  Сбросить выжимку
                </button>
              </div>
            )}
          </Collapsible>

          <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-xs text-zinc-500">
            Инструменты режима (лорбук, персонажи, виджеты) появятся в следующих этапах.
          </div>
        </div>
      </aside>
    </div>
  );
}
