/** Круглый аватар персонажа: картинка или первая буква имени. */
export function Avatar({ src, name, size = 44 }: { src?: string; name: string; size?: number }) {
  return src ? (
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-display font-semibold text-zinc-300"
    >
      {(name[0] ?? '?').toUpperCase()}
    </span>
  );
}
