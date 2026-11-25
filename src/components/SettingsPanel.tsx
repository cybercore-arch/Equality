import { useState } from 'react';
import { GUIDES } from '../guides';
import { useSettings } from '../store/settings';
import { ModelPicker } from './ModelPicker';

const GUIDE_LIST = Object.values(GUIDES).filter((g) => g.link);

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { providers, activeProvider, updateProvider, setActiveProvider, searchEnabled, setSearchEnabled } = useSettings();
  const [guide, setGuide] = useState<number | null>(0);

  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="anim-sheet max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-zinc-900 p-4 md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Подключение к ИИ</h2>
          <button onClick={onClose} className="px-2 text-zinc-400">
            ✕
          </button>
        </div>

        {GUIDE_LIST.map((g, i) => (
          <div key={g.title} className="mb-2 rounded-xl bg-zinc-800/60">
            <button className="w-full px-3 py-2.5 text-left text-sm font-medium" onClick={() => setGuide(guide === i ? null : i)}>
              {guide === i ? '▾' : '▸'} {g.title}
            </button>
            {guide === i && (
              <div className="px-3 pb-3 text-sm text-zinc-300">
                <ol className="list-decimal space-y-1 pl-5">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <a href={g.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-zinc-200 underline">
                  Открыть страницу ключей
                </a>
              </div>
            )}
          </div>
        ))}

        <label className="mt-4 flex items-start gap-3 rounded-xl bg-zinc-800/60 p-3 text-sm">
          <input type="checkbox" checked={searchEnabled} onChange={(e) => setSearchEnabled(e.target.checked)} className="mt-1" />
          <span>
            Поиск Google в режиме «Общение»
            <span className="block text-xs text-zinc-500">
              Только для Gemini. На бесплатных ключах часто недоступен и даёт ошибку 429.
            </span>
          </span>
        </label>

        <div className="mt-4 space-y-3">
          {providers.map((p) => (
            <div key={p.id} className={`rounded-xl border p-3 ${p.id === activeProvider ? 'border-fg/60' : 'border-zinc-800'}`}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="radio" checked={p.id === activeProvider} onChange={() => setActiveProvider(p.id)} />
                {p.name}
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
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Ключи хранятся только на этом устройстве и отправляются только выбранному провайдеру. Названия моделей у
          провайдеров периодически меняются — при ошибке «model not found» поправь поле «Модель».
        </p>
      </div>
    </div>
  );
}
