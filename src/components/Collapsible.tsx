import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Секция, которая плавно раскрывается по нажатию на заголовок. */
export function Collapsible({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Короткая подпись под заголовком (например, текущее значение) */
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl bg-zinc-800/50">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {hint && <span className="block truncate text-xs text-zinc-500">{hint}</span>}
        </span>
        <Icon name="down" size={16} className={`shrink-0 text-zinc-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
