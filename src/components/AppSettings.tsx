import { useState } from 'react';
import { useOverlay } from '../lib/overlay';
import { PROVIDER_LABEL } from '../guides';
import { useSettings } from '../store/settings';
import { GlobalPromptSheet } from './GlobalPromptSheet';
import { Icon } from './Icon';
import { SettingsPanel } from './SettingsPanel';
import { ThemeToggle } from './ThemeToggle';

function Row({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 text-left transition-colors hover:bg-zinc-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-zinc-500">{hint}</span>
      </span>
      <Icon name="right" size={18} className="shrink-0 text-zinc-500" />
    </button>
  );
}

/** Настройки всего приложения: тема, оформление, подключение к ИИ. */
export function AppSettings({ onClose: onCloseProp, onAppearance }: { onClose: () => void; onAppearance: () => void }) {
  const { closing, close: onClose } = useOverlay(onCloseProp);
  const [providers, setProviders] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const globalPrompt = useSettings((s) => s.globalPrompt);
  const active = useSettings((s) => s.providers.find((p) => p.id === s.activeProvider));

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-50 overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-5 flex items-center gap-2">
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">Настройки</h1>
        </div>

        <div className="space-y-5">
          <section>
            <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Тема</div>
            <ThemeToggle />
          </section>

          <section className="space-y-2">
            <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Приложение</div>
            <Row title="Оформление" hint="Цвет, фон, прозрачность, размер текста" onClick={onAppearance} />
            <Row
              title="Общий системный промпт"
              hint={globalPrompt.trim() ? globalPrompt.trim().replace(/\s+/g, ' ').slice(0, 60) : 'Не задан. Добавляется во все чаты'}
              onClick={() => setPrompt(true)}
            />
            <Row
              title="Подключение к ИИ"
              hint={active ? `По умолчанию: ${PROVIDER_LABEL[active.id]} · ${active.model || 'модель не выбрана'}` : ''}
              onClick={() => setProviders(true)}
            />
          </section>

          <p className="pt-4 text-center text-xs text-zinc-600">Equality · версия 0.4</p>
        </div>
      </div>
      {providers && <SettingsPanel onClose={() => setProviders(false)} />}
      {prompt && <GlobalPromptSheet onClose={() => setPrompt(false)} />}
    </div>
  );
}
