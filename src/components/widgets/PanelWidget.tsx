/** Свой виджет: панель с текстом, который обновляет модель (инвентарь, квесты, дневник и т.п.). */
export function PanelWidget({ entries, log }: { entries: string[]; log: boolean }) {
  if (!entries.length) return <div className="px-1 py-4 text-center text-xs text-zinc-500">Пока пусто. Панель заполнит модель в одном из следующих ответов.</div>;
  const shown = log ? [...entries].reverse() : entries;
  return (
    <div className="space-y-2 text-sm">
      {shown.map((t, i) => (
        <div key={i} className="whitespace-pre-wrap break-words rounded-xl bg-zinc-800/60 px-3 py-2 text-zinc-200">
          {t}
        </div>
      ))}
    </div>
  );
}
