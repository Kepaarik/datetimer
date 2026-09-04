import { useEffect, useRef } from "react";

type Kind =
  | "ember"
  | "snow"
  | "trail"
  | "firefly"
  | "star"
  | "meteor"
  | "rain";

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  phase: number;
}

export interface ParticleFXProps {
  embers: boolean;
  snow: boolean;
  trail: boolean;
  fireflies: boolean;
  stars: boolean;
  meteors: boolean;
  rain: boolean;
  /** светлая тема — аддитивное свечение глушится */
  light: boolean;
  /** CSS-цвет акцента (искры, светлячки, метеоры, след) */
  accent: string;
  /** CSS-цвет нейтральных частиц (снег, звёзды, дождь) */
  neutral: string;
}

const CAPS: Record<Kind, number> = {
  ember: 36,
  snow: 120,
  trail: 70,
  firefly: 26,
  star: 90,
  meteor: 4,
  rain: 130,
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Лёгкий канвас-слой с семью пулами частиц: искры, снег, след курсора,
 * светлячки, звёзды, метеоры и дождь. Всё в одном rAF-цикле; каждый пул
 * плавно набирает и гасит плотность при переключении в настройках.
 */
export function ParticleFX(props: ParticleFXProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optsRef = useRef(props);
  optsRef.current = props;

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
    let meteorTimer = rnd(0.6, 2);
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

    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.moved = true;
    };
    window.addEventListener("mousemove", onMouse);

    const count = (k: Kind) => {
      let n = 0;
      for (const p of parts) if (p.kind === k) n++;
      return n;
    };

    const spawn = (kind: Kind): Particle => {
      const base: Particle = {
        kind,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        phase: Math.random() * Math.PI * 2,
      };
      switch (kind) {
        case "ember":
          base.x = rnd(0, w);
          base.y = h + 12;
          base.vx = rnd(-9, 9);
          base.vy = -rnd(22, 58);
          base.size = rnd(1, 2.4);
          base.maxLife = rnd(5, 9);
          break;
        case "snow":
          base.x = rnd(0, w);
          base.y = rnd(-h * 0.2, -6);
          base.vx = rnd(-6, 6);
          base.vy = rnd(26, 60);
          base.size = rnd(1, 2.8);
          base.maxLife = 999;
          break;
        case "trail":
          base.x = mouse.x + rnd(-3, 3);
          base.y = mouse.y + rnd(-3, 3);
          base.vx = rnd(-14, 14);
          base.vy = rnd(-14, 14);
          base.size = rnd(1, 2.6);
          base.maxLife = rnd(0.35, 0.7);
          break;
        case "firefly":
          base.x = rnd(0, w);
          base.y = rnd(0, h);
          base.vx = rnd(-7, 7);
          base.vy = rnd(-6, 6);
          base.size = rnd(1.4, 2.6);
          base.maxLife = rnd(7, 12);
          break;
        case "star":
          base.x = rnd(0, w);
          base.y = rnd(0, h);
          base.vx = rnd(-3, 3);
          base.vy = -rnd(4, 16);
          base.size = rnd(0.7, 1.9);
          base.maxLife = 999;
          break;
        case "meteor":
          base.x = rnd(w * 0.25, w * 1.05);
          base.y = rnd(-h * 0.1, h * 0.3);
          base.vx = -rnd(380, 620);
          base.vy = rnd(160, 300);
          base.size = rnd(1.4, 2.2);
          base.maxLife = rnd(0.9, 1.4);
          break;
        case "rain":
          base.x = rnd(-w * 0.1, w);
          base.y = rnd(-h * 0.3, -6);
          base.vx = -rnd(30, 60);
          base.vy = rnd(620, 950);
          base.size = rnd(1, 2);
          base.maxLife = 999;
          break;
      }
      return base;
    };

    const maintain = (kind: Kind, on: boolean, target: number, perFrame = 2) => {
      const n = count(kind);
      if (on && n < target) {
        for (let i = 0; i < Math.min(perFrame, target - n); i++)
          parts.push(spawn(kind));
      }
    };

    const tick = (dt: number, t: number) => {
      const o = optsRef.current;

      maintain("ember", o.embers, CAPS.ember);
      maintain("snow", o.snow, CAPS.snow, 3);
      maintain("firefly", o.fireflies, CAPS.firefly);
      maintain("star", o.stars, CAPS.star, 3);
      maintain("rain", o.rain, CAPS.rain, 4);

      if (o.meteors) {
        meteorTimer -= dt;
        if (meteorTimer <= 0 && count("meteor") < CAPS.meteor) {
          parts.push(spawn("meteor"));
          meteorTimer = rnd(1.6, 4.2);
        }
      }

      if (o.trail && mouse.moved) {
        if (count("trail") < CAPS.trail) parts.push(spawn("trail"));
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;

        switch (p.kind) {
          case "ember":
            p.x += (p.vx + Math.sin(t * 1.4 + p.phase) * 10) * dt;
            p.y += p.vy * dt;
            break;
          case "snow":
            p.x += (p.vx + Math.sin(t * 0.9 + p.phase) * 14) * dt;
            p.y += p.vy * dt;
            if (p.y > h + 8) {
              p.y = -6;
              p.x = rnd(0, w);
            }
            break;
          case "trail":
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            break;
          case "firefly":
            p.x += (p.vx + Math.sin(t * 0.7 + p.phase) * 16) * dt;
            p.y += (p.vy + Math.cos(t * 0.55 + p.phase) * 13) * dt;
            if (p.x < -20) p.x = w + 18;
            if (p.x > w + 20) p.x = -18;
            if (p.y < -20) p.y = h + 18;
            if (p.y > h + 20) p.y = -18;
            break;
          case "star":
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < -6) {
              p.y = h + 5;
              p.x = rnd(0, w);
            }
            if (p.x < -6) p.x = w + 5;
            if (p.x > w + 6) p.x = -5;
            break;
          case "meteor":
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            break;
          case "rain":
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y > h + 10) {
              p.y = rnd(-h * 0.25, -6);
              p.x = rnd(-w * 0.1, w);
            }
            break;
        }

        const off =
          (p.kind === "ember" || p.kind === "firefly" || p.kind === "meteor") &&
          (p.life > p.maxLife || p.y < -30 || p.x < -60);
        const deadTrail = p.kind === "trail" && p.life > p.maxLife;
        if (off || deadTrail) parts.splice(i, 1);
      }
    };

    const draw = (t: number) => {
      const o = optsRef.current;
      ctx.clearRect(0, 0, w, h);

      const fade = (p: Particle) => {
        if (p.kind === "ember" || p.kind === "firefly" || p.kind === "meteor")
          return Math.min(1, p.life * 2, (p.maxLife - p.life) * 1.4);
        if (p.kind === "trail") return 1 - p.life / p.maxLife;
        return 1;
      };

      /* --- обычный проход: дождь, снег, звёзды --- */
      ctx.globalCompositeOperation = "source-over";
      for (const p of parts) {
        if (p.kind === "rain") {
          const len = p.vy * 0.02;
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = o.neutral;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.016, p.y - len);
          ctx.stroke();
        } else if (p.kind === "snow") {
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.1 + p.phase);
          ctx.fillStyle = o.neutral;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "star") {
          const tw = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.phase));
          ctx.globalAlpha = tw * 0.85;
          ctx.fillStyle = o.neutral;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* --- светящийся проход: искры, светлячки, след, метеоры --- */
      ctx.globalCompositeOperation = o.light ? "source-over" : "lighter";

      const glowDot = (x: number, y: number, r: number, alpha: number) => {
        ctx.globalAlpha = alpha * 0.16;
        ctx.beginPath();
        ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      for (const p of parts) {
        const a = fade(p);
        if (a <= 0.01) continue;
        if (p.kind === "ember") {
          ctx.fillStyle = o.accent;
          glowDot(p.x, p.y, p.size, a * 0.8);
        } else if (p.kind === "firefly") {
          const blink = Math.pow(0.5 + 0.5 * Math.sin(t * 1.6 + p.phase * 3), 2.2);
          ctx.fillStyle = o.accent;
          glowDot(p.x, p.y, p.size, a * (0.25 + 0.75 * blink));
        } else if (p.kind === "trail") {
          ctx.fillStyle = o.accent;
          glowDot(p.x, p.y, p.size, a * 0.55);
        } else if (p.kind === "meteor") {
          const tx = p.x - p.vx * 0.11;
          const ty = p.y - p.vy * 0.11;
          const grad = ctx.createLinearGradient(p.x, p.y, tx, ty);
          grad.addColorStop(0, o.accent);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = a * 0.55;
          ctx.strokeStyle = grad;
          ctx.lineWidth = p.size * 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          glowDot(p.x, p.y, p.size, a * 0.9);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tick(dt, t / 1000);
      draw(t / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
      aria-hidden="true"
    />
  );
}
