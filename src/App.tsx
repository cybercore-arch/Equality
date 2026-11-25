import { useEffect, useState } from 'react';
import { AppearancePanel } from './components/AppearancePanel';
import { Background } from './components/Background';
import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';
import { SettingsPanel } from './components/SettingsPanel';
import { Welcome } from './components/Welcome';
import { Sidebar } from './components/Sidebar';
import { MODES } from './modes';
import { useChat } from './store/chat';
import { useSettings } from './store/settings';
import { applyTheme, useTheme } from './store/theme';

export default function App() {
  const init = useChat((s) => s.init);
  const modeId = useSettings((s) => s.modeId);
  const setMode = useSettings((s) => s.setMode);
  const providerName = useSettings((s) => s.providers.find((p) => p.id === s.activeProvider)?.name);
  const [sidebar, setSidebar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [appearance, setAppearance] = useState(false);

  const onboarded = useSettings((s) => s.onboarded);

  // Применяем тему к CSS-переменным при любом изменении настроек и при смене системной темы
  useEffect(() => {
    const apply = () => applyTheme(useTheme.getState());
    apply();
    const unsub = useTheme.subscribe(apply);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => {
      unsub();
      mq.removeEventListener('change', apply);
    };
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  if (!onboarded) return <Welcome />;

  return (
    <div className="relative flex h-[100dvh] text-zinc-100">
      <Background />
      <Sidebar open={sidebar} onClose={() => setSidebar(false)} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="glass flex items-center gap-2 border-b border-fg/5 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button onClick={() => setSidebar(true)} className="px-2 text-xl md:hidden" aria-label="Чаты">
            ☰
          </button>
          <img src="./favicon.svg" alt="" className="h-6 w-6 rounded-md" />
          <span className="hidden text-sm font-semibold tracking-wide sm:block">Equality</span>
          <select
            value={modeId}
            onChange={(e) => setMode(e.target.value)}
            className="field min-w-0 rounded-lg px-2 py-1.5 text-sm outline-none"
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="hidden min-w-0 flex-1 truncate text-xs text-zinc-400 sm:block">{providerName}</span>
          <span className="flex-1 sm:hidden" />
          <button onClick={() => setAppearance((v) => !v)} className="px-2 text-xl" title="Оформление">
            🎨
          </button>
          <button onClick={() => setSettings(true)} className="px-2 text-xl" title="Настройки">
            ⚙
          </button>
        </header>
        <ChatView />
        <Composer />
      </main>
      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
      {appearance && <AppearancePanel onClose={() => setAppearance(false)} />}
    </div>
  );
}
