/** @type {import('tailwindcss').Config} */

// Серая шкала берётся из CSS-переменных (см. index.css): в светлой теме она "переворачивается",
// поэтому все классы zinc-* автоматически работают в обеих темах.
const zinc = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `rgb(var(--z-${n}) / <alpha-value>)`]),
);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zinc,
        // "Цвет текста": белый в тёмной теме, почти чёрный в светлой. Для границ и подсветок: border-fg/5
        fg: 'rgb(var(--z-50) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
