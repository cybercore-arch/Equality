import { useState } from 'react';
import { GUIDES, PROVIDER_HINT, PROVIDER_LABEL } from '../guides';
import { useOverlay } from '../lib/overlay';
import { CATALOG } from '../providers/catalog';
import { useSettings } from '../store/settings';
import type { ProviderKind } from '../types';
import { ModelPicker } from './ModelPicker';

/** Подключение к ИИ: показываем только те провайдеры, которые настроены; остальные добавляются кнопкой. */
export function SettingsPanel({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const secure = useSettings((s) => s.secure);
  const { providers, activeProvider, updateProvider, setActiveProvider, searchEnabled, setSearchEnabled } = useSettings();
  const [added, setAdded] = useState<ProviderKind[]>([]);
  const [adding, setAdding] = useState(false);
  const [guideFor, setGuideFor] = useState<ProviderKind | null>(null);

  const shown = providers.filter(
    (p) => p.apiKey.trim() || p.id === activeProvider || added.includes(p.id) || (p.id === 'custom' && p.baseUrl?.trim()),
  );
  const hidden = CATALOG.filter((m) => !shown.some((p) => p.id === m.id));

  return (
    <div className={`${closing ? 'anim-fade-out' : 'anim-fade'} fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center`} onClick={onClose}>
      <div
        className={`${closing ? 'anim-sheet-out' : 'anim-sheet'} max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Подключение к ИИ</h2>
          <button onClick={onClose} className="px-2 text-zinc-400">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-zinc-500">Отметь кружком провайдера по умолчанию. Для конкретного чата провайдера и модель можно сменить вверху чата.</p>

        <div className="space-y-3">
          {shown.map((p) => {
            const g = GUIDES[p.id];
            return (
              <div key={p.id} className={`rounded-xl border p-3 ${p.id === activeProvider ? 'border-fg/60' : 'border-zinc-800'}`}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="radio" checked={p.id === activeProvider} onChange={() => setActiveProvider(p.id)} className="accent-[rgb(var(--accent-rgb))]" />
                  {PROVIDER_LABEL[p.id]}
                  <span className="text-xs font-normal text-zinc-500">{PROVIDER_HINT[p.id]}</span>
                </label>
                {p.id === 'custom' && (
                  <input
                    value={p.baseUrl ?? ''}
                    onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                    placeholder="Base URL, например https://api.example.com/v1"
                    className="mt-2 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none"
                  />
                )}
                <input
                  type="password"
                  value={p.apiKey}
                  onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                  placeholder="API-ключ"
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={p.model}
                  onChange={(e) => updateProvider(p.id, { model: e.target.value })}
                  placeholder="Модель"
                  className="mt-2 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm outline-none"
                />
                <ModelPicker cfg={p} onPick={(id) => updateProvider(p.id, { model: id })} />
                <button onClick={() => setGuideFor(guideFor === p.id ? null : p.id)} className="mt-2 text-xs text-zinc-500 underline underline-offset-2">
                  Где взять ключ?
                </button>
                {guideFor === p.id && (
                  <div className="anim-fade mt-2 rounded-lg bg-zinc-800/60 p-3 text-xs text-zinc-300">
                    <div className="mb-1 font-medium text-zinc-100">{g.title}</div>
                    <ol className="list-decimal space-y-1 pl-5">
                      {g.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    {g.link && (
                      <a href={g.link} target="_blank" rel="noreferrer" className="mt-2 inline-block underline underline-offset-2">
                        Открыть страницу ключей
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hidden.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setAdding((v) => !v)} className="w-full rounded-xl bg-zinc-800 py-2.5 text-sm text-zinc-300">
              {adding ? 'Скрыть список' : 'Добавить провайдера'}
            </button>
            {adding && (
              <div className="anim-fade mt-2 flex flex-wrap gap-2">
                {hidden.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setAdded((a) => [...a, m.id]);
                      setGuideFor(m.id);
                    }}
                    className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
                  >
                    + {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="mt-4 flex items-start gap-3 rounded-xl bg-zinc-800/60 p-3 text-sm">
          <input type="checkbox" checked={searchEnabled} onChange={(e) => setSearchEnabled(e.target.checked)} className="mt-1 accent-[rgb(var(--accent-rgb))]" />
          <span>
            Поиск Google в режиме «Общение»
            <span className="block text-xs text-zinc-500">Только для Gemini. На бесплатных ключах часто недоступен и даёт ошибку 429.</span>
          </span>
        </label>

        <p className="mt-3 text-xs text-zinc-500">
          Ключи хранятся только на этом устройстве и отправляются только своему провайдеру. {secure?.ok ? 'На Android они лежат в защищённом хранилище (Keystore). ' : secure ? `Защищённое хранилище Android не запустилось (${secure.error ?? 'ошибка'}), поэтому ключи пока хранятся в обычной памяти приложения. ` : ''}Названия
          моделей у провайдеров периодически меняются: при ошибке «model not found» выбери модель из списка.
        </p>
      </div>
    </div>
  );
}
