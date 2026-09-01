import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { GlyphRain } from "./components/canvasui/GlyphRain";
import { Ripple } from "./components/canvasui/Ripple";
import { TimerDigits } from "./components/TimerDigits";
import { DateMenu } from "./components/DateMenu";
import { Scramble } from "./components/Scramble";
import {
  formatClock,
  formatDuration,
  formatTarget,
  splitRemaining,
} from "./lib/time";

const LS_TARGET = "countdown:target";
const LS_FROM = "countdown:from";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Phase = "idle" | "running" | "finished";

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();
    const notes = [659.25, 880, 1318.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.16, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    });
    setTimeout(() => ctx.close(), 2200);
  } catch {
    /* звук не обязателен */
  }
}

function fireConfetti() {
  const colors = ["#e7ecf1", "#aab8c6", "#c6d2dd", "#8fa3b5", "#f2f5f8"];
  const shot = (origin: { x: number; y: number }, angle: number) =>
    confetti({
      particleCount: 70,
      spread: 62,
      startVelocity: 34,
      gravity: 0.9,
      scalar: 0.9,
      ticks: 210,
      origin,
      angle,
      colors,
    });
  shot({ x: 0.08, y: 0.62 }, 60);
  shot({ x: 0.92, y: 0.62 }, 120);
  setTimeout(() => shot({ x: 0.5, y: 0.42 }, 90), 260);
}

function loadStored(): { target: number | null; from: number | null } {
  try {
    const t = Number(localStorage.getItem(LS_TARGET));
    const f = Number(localStorage.getItem(LS_FROM));
    return {
      target: Number.isFinite(t) && t > 0 ? t : null,
      from: Number.isFinite(f) && f > 0 ? f : null,
    };
  } catch {
    return { target: null, from: null };
  }
}

export default function App() {
  const stored = useRef(loadStored());
  const [target, setTarget] = useState<number | null>(stored.current.target);
  const [from, setFrom] = useState<number | null>(stored.current.from);
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const firedRef = useRef(
    stored.current.target !== null && stored.current.target <= Date.now(),
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  /* периодические глитч-вспышки сигнала */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let nextId = 0;
    let burstId = 0;
    const loop = () => {
      nextId = window.setTimeout(() => {
        if (!alive) return;
        setGlitching(true);
        burstId = window.setTimeout(() => {
          setGlitching(false);
          if (alive) loop();
        }, 230 + Math.random() * 250);
      }, 2600 + Math.random() * 4200);
    };
    loop();
    return () => {
      alive = false;
      window.clearTimeout(nextId);
      window.clearTimeout(burstId);
    };
  }, []);

  const bars = useMemo(
    () =>
      glitching
        ? [0, 1, 2].map(() => ({
            top: `${8 + Math.random() * 82}%`,
            height: `${1 + Math.random() * 5}px`,
          }))
        : [],
    [glitching],
  );

  const phase: Phase =
    target === null ? "idle" : now >= target ? "finished" : "running";
  const remaining = splitRemaining(target ? target - now : 0);

  /* финал: звук + конфетти один раз */
  useEffect(() => {
    if (phase === "finished" && !firedRef.current) {
      firedRef.current = true;
      playChime();
      fireConfetti();
    }
  }, [phase]);

  const setTimer = useCallback((ts: number) => {
    const t = Math.round(ts);
    setTarget(t);
    setFrom(Date.now());
    firedRef.current = false;
    setMenuOpen(false);
    try {
      localStorage.setItem(LS_TARGET, String(t));
      localStorage.setItem(LS_FROM, String(Date.now()));
    } catch {
      /* приватный режим — переживём */
    }
  }, []);

  const resetTimer = useCallback(() => {
    setTarget(null);
    setFrom(null);
    setMenuOpen(false);
    firedRef.current = false;
    try {
      localStorage.removeItem(LS_TARGET);
      localStorage.removeItem(LS_FROM);
    } catch {
      /* noop */
    }
  }, []);

  const progress =
    target !== null && from !== null && target > from
      ? Math.min(1, Math.max(0, (now - from) / (target - from)))
      : 0;

  const chip =
    phase === "running"
      ? { text: "отсчёт идёт", dot: "bg-lagoon", cls: "text-ember border-line" }
      : phase === "finished"
        ? { text: "время вышло", dot: "bg-alarm", cls: "text-alarm border-alarm/40" }
        : { text: "ожидание цели", dot: "bg-dim", cls: "text-fog border-line" };

  return (
    <GlyphRain
      className="fixed inset-0"
      charset="0123456789:·—+×∞%#▓▒░"
      cell={16}
      color={[0.4, 0.45, 0.51]}
      headColor={[0.8, 0.86, 0.92]}
      speed={0.13}
      speedVariance={0.6}
      density={0.06}
      trail={1.15}
      glow={1.2}
      mutate={0.5}
      flicker={0.3}
      layers={2}
      dim={0}
      light={0}
      stir={0.85}
      stirRadius={240}
      settle={1}
    >
      <Ripple
        className="relative h-full"
        amplitude={0.7}
        speed={0.75}
        wavelength={110}
        rings={3}
        decay={0.85}
        refraction={80}
        dispersion={0.45}
        shine={0.95}
        trigger="click"
      >
        <div className="scene-bg noise scanlines relative flex h-full flex-col overflow-hidden">
          <div className="vhs-band" aria-hidden="true" />

          {/* уголки-метки */}
          {[
            "left-4 top-16",
            "right-4 top-16",
            "left-4 bottom-10",
            "right-4 bottom-10",
          ].map((pos) => (
            <span
              key={pos}
              className={`pointer-events-none absolute ${pos} font-mono text-sm text-dim/60`}
              aria-hidden="true"
            >
              +
            </span>
          ))}

          {/* шапка */}
          <header className="fade-up relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
            <div className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel text-ember">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" {...stroke}>
                  <path d="M7 3h10M7 21h10M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21" />
                </svg>
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-flare" />
              </span>
              <div className="leading-tight">
                <Scramble
                  text="Обратный отсчёт"
                  className="font-display text-[13px] font-semibold tracking-[0.22em] text-ink uppercase"
                />
                <div className="font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
                  таймер до заданной даты
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="hidden text-right leading-tight sm:block">
                <div className="font-mono text-sm font-medium text-ink tabular-nums">
                  {formatClock(now)}
                </div>
                <div className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                  {new Date(now).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              </div>
              <a
                href="https://canvasui.dev"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex items-center gap-2 rounded-md border border-line bg-panel/80 px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-fog uppercase"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-lagoon/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-lagoon" />
                </span>
                Canvas UI
              </a>
            </div>
          </header>

          <div className="hairline-top relative z-10 mx-6 sm:mx-10" />

          {/* сцена таймера */}
          <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4">
            {/* полосы помех во время глитча */}
            {bars.map((b, i) => (
              <span
                key={`${glitching}-${i}`}
                className="glitch-bar"
                style={{ top: b.top, height: b.height }}
                aria-hidden="true"
              />
            ))}

            {/* вращающееся кольцо за цифрами */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 200 200"
                className="spin-slow h-[min(78vmin,620px)] w-[min(78vmin,620px)] text-line/70"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="96"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeDasharray="2 7"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="78"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  strokeDasharray="1 11"
                />
                <path d="M100 1v8M100 191v8M1 100h8M191 100h8" stroke="#3d4750" strokeWidth="1" />
              </svg>
            </div>

            <div className="fade-up relative flex flex-col items-center" style={{ animationDelay: "0.08s" }}>
              {/* статус */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`btn-ghost mb-7 flex items-center gap-2.5 rounded-full border bg-panel/80 px-4 py-1.5 font-mono text-[10.5px] tracking-[0.22em] uppercase ${chip.cls}`}
                aria-expanded={menuOpen}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${chip.dot} ${
                    phase === "finished" ? "alarm-flash" : phase === "running" ? "animate-pulse" : ""
                  }`}
                />
                {chip.text}
              </button>

              {/* сам таймер — нажатие открывает меню выбора даты */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className={[
                    "group block cursor-pointer rounded-xl px-4 py-2 transition-transform duration-300 sm:px-8",
                    phase === "finished" ? "" : "hover:scale-[1.015] active:scale-[0.995]",
                  ].join(" ")}
                  aria-label="Открыть меню выбора конечной даты"
                >
                  {phase === "finished" ? (
                    <div className="flex flex-col items-center gap-4">
                      <span className="pulse-ring flex items-center gap-3 rounded-full border border-alarm/40 bg-alarm/10 px-6 py-2.5">
                        <svg viewBox="0 0 24 24" className="alarm-flash h-5 w-5 text-alarm" {...stroke}>
                          <path d="M12 3v2M18.4 5.6l-1.4 1.4M21 12h-2M5 12H3M5.6 5.6 7 7" />
                          <path d="M8 19a4 4 0 1 1 8 0" />
                          <path d="M4 19h16" />
                        </svg>
                        <span className="glitch-hard font-display text-lg font-semibold tracking-[0.28em] text-alarm uppercase sm:text-2xl">
                          Время вышло
                        </span>
                      </span>
                      <TimerDigits
                        days={0}
                        hours={0}
                        minutes={0}
                        seconds={0}
                        alarm
                        sizeClass="text-[clamp(1.8rem,6.5vw,3.6rem)] opacity-60"
                      />
                    </div>
                  ) : (
                    <TimerDigits
                      days={remaining.days}
                      hours={remaining.hours}
                      minutes={remaining.minutes}
                      seconds={remaining.seconds}
                      glitching={glitching && phase === "running"}
                      sizeClass="text-[clamp(2.4rem,10vw,7.5rem)]"
                    />
                  )}
                  <span className="pointer-events-none absolute inset-x-8 -bottom-1 h-px bg-gradient-to-r from-transparent via-linehi/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>

                <DateMenu
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  onSet={setTimer}
                  onReset={resetTimer}
                  currentTarget={target}
                />
              </div>

              {/* строка под таймером */}
              <div className="mt-7 flex min-h-6 items-center justify-center px-4 text-center">
                {phase === "running" && target !== null ? (
                  <p className="font-mono text-[12px] tracking-[0.08em] text-fog sm:text-[13px]">
                    до{" "}
                    <span className="text-ember">{formatTarget(target)}</span>
                    <span className="mx-2 text-dim">·</span>
                    <span className="text-lagoon">
                      {formatDuration(target - now)}
                    </span>
                  </p>
                ) : phase === "finished" && target !== null ? (
                  <p className="font-mono text-[12px] tracking-[0.08em] text-fog">
                    цель была —{" "}
                    <span className="text-ember">{formatTarget(target)}</span>
                  </p>
                ) : (
                  <p className="font-mono text-[12px] tracking-[0.08em] text-dim">
                    нажмите на таймер, чтобы выбрать конечную дату
                  </p>
                )}
              </div>

              {/* действия */}
              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="btn-ghost flex items-center gap-2.5 rounded-md border border-flare/60 bg-flare/15 px-6 py-3 font-display text-[12px] font-semibold tracking-[0.16em] text-ember uppercase shadow-[0_0_36px_rgba(169,183,197,0.12)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                    <path d="M3.5 9.5h17M8 2.8V6M16 2.8V6M12 12.5v4M10 14.5h4" />
                  </svg>
                  Выбрать дату
                </button>
                {phase !== "idle" && (
                  <button
                    onClick={resetTimer}
                    className="btn-ghost flex items-center gap-2 rounded-md border border-line bg-panel/80 px-5 py-3 font-display text-[12px] font-medium tracking-[0.16em] text-fog uppercase"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
                      <path d="M3.5 3.5v5h5" />
                    </svg>
                    Сбросить
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* подвал + прогресс */}
          <footer className="fade-up relative z-10 px-6 pb-4 pt-2 sm:px-10" style={{ animationDelay: "0.16s" }}>
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
              <span>
                {phase === "running"
                  ? `прогресс ${(progress * 100).toFixed(1)}%`
                  : phase === "finished"
                    ? "отсчёт завершён"
                    : "цель не выбрана"}
              </span>
              <span className="hidden items-center gap-2 sm:flex">
                Ripple + Glyph Rain
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-lagoon" {...stroke}>
                  <path d="M12 21c-4-3.5-7-6.6-7-10a7 7 0 1 1 14 0c0 3.4-3 6.5-7 10Z" />
                </svg>
              </span>
            </div>
            <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-line/60">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-linehi via-flare to-ink transition-[width] duration-300 ease-linear"
                style={{ width: `${phase === "finished" ? 100 : progress * 100}%` }}
              >
                {phase === "running" && (
                  <span className="progress-sheen absolute inset-0" />
                )}
              </div>
            </div>
          </footer>
        </div>
      </Ripple>
    </GlyphRain>
  );
}
