import { useEffect, useState } from 'react';
import { AppearancePanel } from './components/AppearancePanel';
import { AppSettings } from './components/AppSettings';
import { Background } from './components/Background';
import { ChatHeader } from './components/ChatHeader';
import { ChatSettingsDrawer } from './components/ChatSettingsDrawer';
import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';
import { ModelSheet } from './components/ModelSheet';
import { Sidebar } from './components/Sidebar';
import { Welcome } from './components/Welcome';
import { useChat } from './store/chat';
import { useSettings } from './store/settings';
import { applyTheme, useTheme } from './store/theme';

export default function App() {
  const init = useChat((s) => s.init);
  const onboarded = useSettings((s) => s.onboarded);

  const [sidebar, setSidebar] = useState(false);
  const [appSettings, setAppSettings] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [chatSettings, setChatSettings] = useState(false);
  const [modelSheet, setModelSheet] = useState(false);

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
      <Sidebar open={sidebar} onClose={() => setSidebar(false)} onSettings={() => setAppSettings(true)} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <ChatHeader
          onMenu={() => setSidebar(true)}
          onModel={() => setModelSheet(true)}
          onSettings={() => setChatSettings(true)}
        />
        <ChatView />
        <Composer />
      </main>

      {modelSheet && <ModelSheet onClose={() => setModelSheet(false)} />}
      {chatSettings && <ChatSettingsDrawer onClose={() => setChatSettings(false)} />}
      {appSettings && (
        <AppSettings
          onClose={() => setAppSettings(false)}
          onAppearance={() => {
            // Закрываем настройки, чтобы видеть изменения оформления прямо в чате
            setAppSettings(false);
            setAppearance(true);
          }}
        />
      )}
      {appearance && <AppearancePanel onClose={() => setAppearance(false)} />}
    </div>
  );
}
