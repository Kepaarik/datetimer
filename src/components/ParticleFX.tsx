import { useEffect, useRef } from "react";

type Kind = "ember" | "snow" | "trail";

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  sway: number;
  phase: number;
}

export interface ParticleFXProps {
  embers: boolean;
  snow: boolean;
  trail: boolean;
  /** светлая тема — частицы темнее, без аддитивного свечения */
  light: boolean;
  /** цвет акцента [r, g, b] в диапазоне 0..1 */
  accent: [number, number, number];
}

const MAX_EMBERS = 36;
const MAX_SNOW = 120;
const MAX_TRAIL = 70;

/**
 * Лёгкий канвас-слой с тремя пулами частиц: восходящие искры,
 * падающий снег и затухающий след за курсором. Всё в одном
 * requestAnimationFrame-цикле, без внешних зависимостей.
 */
export function ParticleFX({ embers, snow, trail, light, accent }: ParticleFXProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optsRef = useRef({ embers, snow, trail, light, accent });
  optsRef.current = { embers, snow, trail, light, accent };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    const parts: Particle[] = [];
    const mouse = { x: -100, y: -100, moved: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.moved = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const spawnEmber = (): Particle => ({
      kind: "ember",
      x: Math.random() * w,
      y: h + 8,
      vx: (Math.random() - 0.5) * 16,
      vy: -(24 + Math.random() * 48),
      life: 1,
      decay: 0.09 + Math.random() * 0.1,
      size: 1 + Math.random() * 2.2,
      sway: 8 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
    });

    const spawnSnow = (anywhere: boolean): Particle => ({
      kind: "snow",
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -6,
      vx: (Math.random() - 0.5) * 10,
      vy: 22 + Math.random() * 34,
      life: 1,
      decay: 0,
      size: 0.8 + Math.random() * 1.9,
      sway: 10 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
    });

    const spawnTrail = (): Particle => {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 22;
      return {
        kind: "trail",
        x: mouse.x + (Math.random() - 0.5) * 6,
        y: mouse.y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 8,
        life: 1,
        decay: 1.6 + Math.random() * 1.4,
        size: 0.8 + Math.random() * 1.6,
        sway: 0,
        phase: 0,
      };
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const o = optsRef.current;

      /* пополнение пулов, пока эффект включён */
      if (o.embers) {
        const n = parts.reduce((s, p) => s + (p.kind === "ember" ? 1 : 0), 0);
        if (n < MAX_EMBERS && Math.random() < 0.55) parts.push(spawnEmber());
      }
      if (o.snow) {
        const n = parts.reduce((s, p) => s + (p.kind === "snow" ? 1 : 0), 0);
        for (let i = n; i < MAX_SNOW; i++) parts.push(spawnSnow(true));
      }
      if (o.trail && mouse.moved) {
        mouse.moved = false;
        const n = parts.reduce((s, p) => s + (p.kind === "trail" ? 1 : 0), 0);
        for (let i = 0; i < 3 && n + i < MAX_TRAIL; i++) parts.push(spawnTrail());
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = o.light ? "source-over" : "lighter";

      const [ar, ag, ab] = o.accent;

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.phase += dt * 2;
        p.x += (p.vx + (p.sway ? Math.sin(p.phase) * p.sway * 0.4 : 0)) * dt;
        p.y += p.vy * dt;

        /* выключенный эффект — пул плавно тает */
        const enabled =
          p.kind === "ember" ? o.embers : p.kind === "snow" ? o.snow : o.trail;
        if (!enabled) p.life -= dt * 1.4;
        else p.life -= p.decay * dt;

        if (p.kind === "snow" && p.y > h + 6) {
          if (o.snow) {
            p.y = -6;
            p.x = Math.random() * w;
          } else {
            p.life = 0;
          }
        }

        if (p.life <= 0 || p.y < -40 || p.x < -40 || p.x > w + 40) {
          parts.splice(i, 1);
          continue;
        }

        const a = Math.max(0, Math.min(1, p.life));
        if (p.kind === "ember") {
          ctx.fillStyle = `rgba(${Math.round(ar * 255)}, ${Math.round(ag * 255)}, ${Math.round(ab * 255)}, ${(a * 0.75).toFixed(3)})`;
        } else if (p.kind === "snow") {
          ctx.fillStyle = o.light
            ? `rgba(96, 110, 122, ${(a * 0.5).toFixed(3)})`
            : `rgba(214, 230, 240, ${(a * 0.5).toFixed(3)})`;
        } else {
          ctx.fillStyle = o.light
            ? `rgba(60, 72, 84, ${(a * 0.4).toFixed(3)})`
            : `rgba(${Math.round(ar * 255)}, ${Math.round(ag * 255)}, ${Math.round(ab * 255)}, ${(a * 0.55).toFixed(3)})`;
        }
        const r = p.size * (p.kind === "ember" ? 0.4 + a * 0.6 : 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[26] h-full w-full"
    />
  );
}
