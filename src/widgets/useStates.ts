import { useMemo } from 'react';
import { useChat } from '../store/chat';
import { useSettings } from '../store/settings';
import { foldWidgets, isPanel, WIDGETS, type WidgetId, type WidgetStates } from './registry';

/** Включённые в текущем чате виджеты и их состояние (вычисляется из сообщений текущей ветки). */
export function useWidgets(): { enabled: WidgetId[]; states: WidgetStates | null } {
  const widgets = useChat((s) => s.chats.find((c) => c.id === s.chatId)?.widgets);
  const messages = useChat((s) => s.messages);
  const path = useChat((s) => s.path);
  const custom = useSettings((s) => s.customWidgets);
  const enabled = (widgets ?? []).filter((id): id is WidgetId => WIDGETS.some((w) => w.id === id) || (isPanel(id) && custom.some((d) => `panel:${d.id}` === id)));
  const key = enabled.join(',');
  const states = useMemo(
    () => (enabled.length ? foldWidgets(path.map((id) => messages[id]).filter(Boolean)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, path, messages],
  );
  return { enabled, states };
}
