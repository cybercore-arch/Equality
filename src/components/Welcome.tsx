import { useEffect, useState } from 'react';
import { GUIDES, PROVIDER_HINT, PROVIDER_LABEL } from '../guides';
import { useSettings } from '../store/settings';
import type { ProviderKind } from '../types';
import { ThemeToggle } from './ThemeToggle';

const ORDER: ProviderKind[] = ['openrouter', 'gemini', 'groq', 'custom'];

/** Печатает текст по буквам. Невидимая копия держит высоту, чтобы вёрстка не прыгала. */
function Typewriter({ text, speed = 80 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN(n + 1), speed);
    return () => clearTimeout(t);
  }, [n, text, speed]);

  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className={`absolute left-0 top-0 whitespace-nowrap ${n < text.length ? 'caret' : ''}`}>
        {text.slice(0, n)}
      </span>
    </span>
  );
}

/** Экран первого запуска: приветствие, выбор провайдера, ключ, тема. */
export function Welcome() {
  const providers = useSettings((s) => s.providers);
  const activeProvider = useSettings((s) => s.activeProvider);
  const updateProvider = useSettings((s) => s.updateProvider);
  const setActiveProvider = useSettings((s) => s.setActiveProvider);
  const setOnboarded = useSettings((s) => s.setOnboarded);

  const [showKey, setShowKey] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const cfg = providers.find((p) => p.id === activeProvider)!;
  const guide = GUIDES[cfg.id];
  const isCustom = cfg.id === 'custom';
  const ready = isCustom ? !!cfg.baseUrl?.trim() && !!cfg.model.trim() : !!cfg.apiKey.trim();

  const finish = () => setOnboarded(true);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          <Typewriter text="Equality" />
        </h1>
        <p className="anim-rise mt-3 text-zinc-400" style={{ animationDelay: '700ms' }}>
          Привет. Подключим ИИ, это займёт минуту.
        </p>

        <div className="anim-rise mt-8" style={{ animationDelay: '900ms' }}>
          <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Провайдер</div>
          <div className="grid grid-cols-2 gap-2">
            {ORDER.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setActiveProvider(id);
                  setShowGuide(false);
                }}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-colors duration-200 ${
                  activeProvider === id ? 'border-fg/70 bg-zinc-800' : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-sm font-medium">{PROVIDER_LABEL[id]}</div>
                <div className="text-xs text-zinc-500">{PROVIDER_HINT[id]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="anim-rise mt-6 space-y-2" style={{ animationDelay: '1050ms' }}>
          {isCustom && (
            <input
              value={cfg.baseUrl ?? ''}
              onChange={(e) => updateProvider(cfg.id, { baseUrl: e.target.value })}
              placeholder="Base URL, например https://api.example.com/v1"
              className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
            />
          )}
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={cfg.apiKey}
              onChange={(e) => updateProvider(cfg.id, { apiKey: e.target.value })}
              placeholder={isCustom ? 'API-ключ (если нужен)' : 'Вставь API-ключ'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-2xl bg-zinc-800 py-3 pl-4 pr-20 text-sm outline-none placeholder:text-zinc-500"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute inset-y-0 right-3 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {showKey ? 'скрыть' : 'показать'}
            </button>
          </div>
          {isCustom && (
            <input
              value={cfg.model}
              onChange={(e) => updateProvider(cfg.id, { model: e.target.value })}
              placeholder="Название модели"
              className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
            />
          )}

          <button
            onClick={() => setShowGuide((v) => !v)}
            className="flex items-center gap-1.5 pt-1 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <span className={`inline-block transition-transform duration-300 ${showGuide ? 'rotate-90' : ''}`}>›</span>
            Где взять ключ?
          </button>

          {/* Плавное раскрытие подсказки */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              showGuide ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-2xl bg-zinc-900 p-4 text-sm text-zinc-300">
                <div className="mb-2 font-medium text-zinc-100">{guide.title}</div>
                <ol className="list-decimal space-y-1 pl-5">
                  {guide.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {guide.link && (
                  <a
                    href={guide.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block underline underline-offset-4"
                  >
                    Открыть страницу ключей
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="anim-rise mt-8" style={{ animationDelay: '1200ms' }}>
          <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Тема</div>
          <ThemeToggle />
        </div>

        <div className="anim-rise mt-8 space-y-3" style={{ animationDelay: '1350ms' }}>
          <button
            onClick={finish}
            disabled={!ready}
            className="btn-accent w-full rounded-2xl py-3 font-medium disabled:opacity-30"
          >
            Продолжить
          </button>
          <button onClick={finish} className="w-full py-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
            Пропустить, настрою позже
          </button>
        </div>
      </div>
    </div>
  );
}
