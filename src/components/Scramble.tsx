import { useEffect, useState } from "react";

const GLYPHS = "▓▒░<>/\\+*=#%$@0123456789";

/**
 * Периодически «расшифровывает» строку: символы на мгновение
 * заменяются глитч-глифами и собираются обратно слева направо.
 */
export function Scramble({
  text,
  className,
  interval = 4600,
}: {
  text: string;
  className?: string;
  interval?: number;
}) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tick: number | undefined;
    let frame = 0;
    const FRAMES = 9;

    const step = () => {
      frame += 1;
      const locked = Math.floor((frame / FRAMES) * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || i < locked) s += ch;
        else
          s +=
            Math.random() < 0.45
              ? ch
              : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      if (frame >= FRAMES) {
        setOut(text);
        window.clearInterval(tick);
        tick = undefined;
      } else {
        setOut(s);
      }
    };

    const start = () => {
      if (tick !== undefined) return;
      frame = 0;
      tick = window.setInterval(step, 46);
    };

    const kickoff = window.setTimeout(start, 650);
    const loop = window.setInterval(start, interval);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(loop);
      if (tick !== undefined) window.clearInterval(tick);
      setOut(text);
    };
  }, [text, interval]);

  return (
    <span className={className} aria-label={text}>
      {out}
    </span>
  );
}
