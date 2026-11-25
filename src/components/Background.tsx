import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { useTheme } from '../store/theme';

/** Фоновая картинка за всем интерфейсом (если пользователь её выбрал). */
export function Background() {
  const version = useTheme((s) => s.bgVersion);
  const blur = useTheme((s) => s.bgBlur);
  const dim = useTheme((s) => s.bgDim);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let current: string | null = null;
    let dead = false;
    void db.kv.get('background').then((row) => {
      if (dead) return;
      if (row) {
        current = URL.createObjectURL(row.value);
        setUrl(current);
      } else {
        setUrl(null);
      }
    });
    return () => {
      dead = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [version]);

  if (!url) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-[-24px] bg-cover bg-center"
        style={{ backgroundImage: `url(${url})`, filter: `blur(${blur}px)` }}
      />
      <div className="absolute inset-0" style={{ background: `rgb(0 0 0 / ${dim})` }} />
    </div>
  );
}
