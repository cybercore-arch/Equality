import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Жест/кнопка «назад» на телефоне: каждое открытое окно кладёт запись в историю WebView,
 * а системное «назад» закрывает верхнее окно вместо выхода из приложения.
 */
type Entry = { close: () => void };
const stack: Entry[] = [];
let skip = 0; // сколько popstate вызвано нами самими (при закрытии кнопкой) и не должно ничего закрывать

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skip > 0) {
      skip--;
      return;
    }
    stack.pop()?.close();
  });
}

export function useBackEntry(active: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!active) return;
    const entry: Entry = { close: () => ref.current() };
    stack.push(entry);
    history.pushState({ eq: stack.length }, '');
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) {
        // закрыто не жестом, а кнопкой: убираем свою запись из истории
        stack.splice(i, 1);
        skip++;
        history.back();
      }
    };
  }, [active]);
}

/** Окно с плавным закрытием и поддержкой жеста «назад». close() сначала играет анимацию, потом вызывает onClose. */
export function useOverlay(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const ref = useRef(onClose);
  ref.current = onClose;
  const close = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setClosing(true);
    setTimeout(() => ref.current(), 220);
  }, []);
  useBackEntry(true, close);
  return { closing, close };
}
