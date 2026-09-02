import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { GlyphRain } from "./components/canvasui/GlyphRain";
import { Ripple } from "./components/canvasui/Ripple";
import { TimerDigits, type Glow } from "./components/TimerDigits";
import { DateMenu } from "./components/DateMenu";
import { Scramble } from "./components/Scramble";
import {
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
  SettingsPanel,
  THEMES,
  type ThemeId,
  type TimerSettings,
} from "./components/SettingsPanel";
import {
  formatClock,
  formatDuration,
  formatTarget,
  splitRemaining,
} from "./lib/time";

const LS_TARGET = "countdown:target";
const LS_FROM = "countdown:from";
const LS_SETTINGS = "countdown:settings";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Phase = "idle" | "running" | "finished";

interface GlitchBar {
  id: number;
  top: number;
  height: number;
}

const THEME_GLYPHS: Record<
  ThemeId,
  { color: [number, number, number]; head: [number, number, number] }
> = {
  steel: { color: [0.52, 0.58, 0.64], head: [0.9, 0.62, 0.25] },
  ember: { color: [0.66, 0.48, 0.3], head: [0.95, 0.58, 0.18] },
  lagoon: { color: [0.28, 0.62, 0.58], head: [0.9, 0.66, 0.3] },
  paper: { color: [0.42, 0.48, 0.54], head: [0.8, 0.5, 0.12] },
};

const THEME_CONFETTI: Record<ThemeId, string[]> = {
  steel: ["#ffd699", "#f59a23", "#3fd6c0", "#c6d2dd", "#e7ecf1"],
  ember: ["#ffd699", "#ff9a23", "#ff5d4d", "#f7d7a8", "#f3e9dc"],
  lagoon: ["#5ee6d0", "#3fd6c0", "#f59a23", "#9fe8dc", "#e6f4f2"],
  paper: ["#d97e0a", "#0fa396", "#141a21", "#a2adb8", "#f6f8fa"],
};

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

function fireConfetti(colors: string[]) {
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

function loadSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<TimerSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...p,
      font: FONT_OPTIONS.some((f) => f.id === p.font)
        ? (p.font as string)
        : DEFAULT_SETTINGS.font,
      theme: THEMES.some((t) => t.id === p.theme)
        ? (p.theme as ThemeId)
        : DEFAULT_SETTINGS.theme,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/* базовый размер подстраивается под экран и число видимых блоков,
   а scale из настроек работает множителем */
function calcFontSize(unitCount: number, scale: number): string {
  const m = scale / 100;
  const r = (n: number) => Math.round(n * m * 100) / 100;
  switch (unitCount) {
    case 2:
      return `min(${r(23)}vw, ${r(19)}vh, ${r(10.5)}rem)`;
    case 3:
      return `min(${r(15)}vw, ${r(16)}vh, ${r(8.5)}rem)`;
    default:
      return `min(${r(11.5)}vw, ${r(13.5)}vh, ${r(7)}rem)`;
  }
}

const SPACING_VALUES: Record<TimerSettings["spacing"], string> = {
  tight: "-0.03em",
  normal: "0em",
  wide: "0.06em",
};

export default function App() {
  const stored = useRef(loadStored());
  const [target, setTarget] = useState<number | null>(stored.current.target);
  const [from, setFrom] = useState<number | null>(stored.current.from);
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<TimerSettings>(loadSettings);
  const [glitchPulse, setGlitchPulse] = useState(0);
  const [bars, setBars] = useState<GlitchBar[]>([]);
  const firedRef = useRef(
    stored.current.target !== null && stored.current.target <= Date.now(),
  );

  /* настройки сохраняются и применяются к документу */
  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    } catch {
      /* noop */
    }
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  /* периодические глитч-сбои сигнала */
  useEffect(() => {
    if (!settings.glitch) {
      setBars([]);
      return;
    }
    let cancelled = false;
    let timeout: number | undefined;
    const schedule = () => {
      timeout = window.setTimeout(() => {
        if (cancelled) return;
        setGlitchPulse((p) => p + 1);
        const stamp = Date.now();
        setBars([
          { id: stamp, top: 14 + Math.random() * 66, height: 1 + Math.random() * 3 },
          {
            id: stamp + 1,
            top: 8 + Math.random() * 80,
            height: 1 + Math.random() * 2,
          },
        ]);
        window.setTimeout(() => {
          if (!cancelled) setBars([]);
        }, 420);
        schedule();
      }, 3400 + Math.random() * 3800);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [settings.glitch]);

  const patchSettings = useCallback((patch: Partial<TimerSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const phase: Phase =
    target === null ? "idle" : now >= target ? "finished" : "running";
  const remaining = splitRemaining(target ? target - now : 0);
  const unitCount =
    remaining.days > 0 ? 4 : remaining.hours > 0 ? 3 : 2;

  /* финал: звук + конфетти один раз */
  useEffect(() => {
    if (phase === "finished" && !firedRef.current) {
      firedRef.current = true;
      playChime();
      fireConfetti(THEME_CONFETTI[settings.theme]);
    }
  }, [phase, settings.theme]);

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
      ? {
          text: "отсчёт идёт",
          dot: "bg-lagoon",
          cls: "text-lagoon border-lagoon/30",
        }
      : phase === "finished"
        ? { text: "время вышло", dot: "bg-alarm", cls: "text-alarm border-alarm/40" }
        : { text: "ожидание цели", dot: "bg-dim", cls: "text-fog border-line" };

  const glitching = settings.glitch && glitchPulse > 0;
  const glitchKey = settings.glitch ? `g-${glitchPulse}` : "g-static";
  const fontFam =
    FONT_OPTIONS.find((f) => f.id === settings.font)?.css ??
    FONT_OPTIONS[0].css;
  const fontSize = calcFontSize(unitCount, settings.scale);
  const spacing = SPACING_VALUES[settings.spacing];
  const glow: Glow = settings.glow;

  const scene = useMemo(
    () => (
      <div className="scene-bg noise scanlines relative flex h-full flex-col overflow-hidden">
        {settings.glitch && <div className="vhs-band" aria-hidden="true" />}
        {bars.map((b) => (
          <span
            key={b.id}
            aria-hidden="true"
            className="glitch-bar"
            style={{ top: `${b.top}%`, height: `${b.height}px` }}
          />
        ))}

        {/* уголки-метки */}
        {["left-4 top-16", "right-4 top-16", "left-4 bottom-10", "right-4 bottom-10"].map(
          (pos) => (
            <span
              key={pos}
              className={`pointer-events-none absolute ${pos} font-mono text-sm text-dim/60`}
              aria-hidden="true"
            >
              +
            </span>
          ),
        )}

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
              <div className="font-display text-[13px] font-semibold tracking-[0.22em] text-ink uppercase">
                <Scramble text="Обратный отсчёт" interval={7000} />
              </div>
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
          {/* вращающееся кольцо за цифрами */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 200 200"
              className="spin-slow h-[min(86vmin,700px)] w-[min(86vmin,700px)] text-line/70"
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
              <path
                d="M100 1v8M100 191v8M1 100h8M191 100h8"
                stroke="currentColor"
                strokeWidth="1"
                className="text-linehi"
              />
            </svg>
          </div>

          <div
            className="fade-up relative flex flex-col items-center"
            style={{ animationDelay: "0.08s" }}
          >
            {/* статус — тоже открывает меню даты */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`btn-ghost mb-5 flex items-center gap-2.5 rounded-full border bg-panel/80 px-4 py-1.5 font-mono text-[10.5px] tracking-[0.22em] uppercase ${chip.cls}`}
              aria-expanded={menuOpen}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${chip.dot} ${
                  phase === "finished"
                    ? "alarm-flash"
                    : phase === "running"
                      ? "animate-pulse"
                      : ""
                }`}
              />
              {chip.text}
            </button>

            {/* сам таймер — не кликабельный */}
            <div className="relative">
              <div className="block rounded-xl px-2 py-2 sm:px-6">
                {phase === "finished" ? (
                  <div className="flex flex-col items-center gap-4">
                    <span
                      className={[
                        "pulse-ring flex items-center gap-3 rounded-full border border-alarm/40 bg-alarm/10 px-6 py-2.5",
                        settings.glitch ? "glitch-hard" : "",
                      ].join(" ")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="alarm-flash h-5 w-5 text-alarm"
                        {...stroke}
                      >
                        <path d="M12 3v2M18.4 5.6l-1.4 1.4M21 12h-2M5 12H3M5.6 5.6 7 7" />
                        <path d="M8 19a4 4 0 1 1 8 0" />
                        <path d="M4 19h16" />
                      </svg>
                      <span className="font-display text-lg font-semibold tracking-[0.28em] text-alarm uppercase sm:text-2xl">
                        Время вышло
                      </span>
                    </span>
                    <TimerDigits
                      days={0}
                      hours={0}
                      minutes={0}
                      seconds={0}
                      alarm
                      glitching={glitching}
                      glow={glow}
                      fontSize={fontSize}
                      fontFamily={fontFam}
                      letterSpacing={spacing}
                      sizeClass="opacity-60"
                    />
                  </div>
                ) : (
                  <TimerDigits
                    key={glitchKey}
                    days={remaining.days}
                    hours={remaining.hours}
                    minutes={remaining.minutes}
                    seconds={remaining.seconds}
                    glitching={glitching}
                    glow={glow}
                    fontSize={fontSize}
                    fontFamily={fontFam}
                    letterSpacing={spacing}
                  />
                )}
              </div>
            </div>

            {/* строка под таймером */}
            <div className="mt-5 flex min-h-6 items-center justify-center px-4 text-center">
              {phase === "running" && target !== null ? (
                <p className="font-mono text-[12px] tracking-[0.08em] text-fog sm:text-[13px]">
                  до <span className="text-ember">{formatTarget(target)}</span>
                  <span className="mx-2 text-dim">·</span>
                  <span className="text-lagoon">{formatDuration(target - now)}</span>
                </p>
              ) : phase === "finished" && target !== null ? (
                <p className="font-mono text-[12px] tracking-[0.08em] text-fog">
                  цель была — <span className="text-ember">{formatTarget(target)}</span>
                </p>
              ) : (
                <p className="font-mono text-[12px] tracking-[0.08em] text-dim">
                  выберите конечную дату кнопкой ниже
                </p>
              )}
            </div>

            {/* действия */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                className="btn-ghost flex items-center gap-2.5 rounded-md border border-flare/60 bg-flare/15 px-6 py-3 font-display text-[12px] font-semibold tracking-[0.16em] text-ember uppercase shadow-[0_0_36px_rgba(245,154,35,0.14)]"
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
        <footer
          className="fade-up relative z-10 px-6 pb-4 pt-2 sm:px-10"
          style={{ animationDelay: "0.16s" }}
        >
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
              className="relative h-full rounded-full bg-gradient-to-r from-lagoon via-icefox to-ember transition-[width] duration-300 ease-linear"
              style={{ width: `${phase === "finished" ? 100 : progress * 100}%` }}
            >
              {phase === "running" && (
                <span className="progress-sheen absolute inset-0" />
              )}
            </div>
          </div>
        </footer>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      now,
      phase,
      target,
      progress,
      menuOpen,
      chip,
      remaining,
      unitCount,
      glitching,
      glitchKey,
      fontSize,
      fontFam,
      spacing,
      glow,
      settings.glitch,
      bars,
    ],
  );

  return (
    <div className="fixed inset-0 overflow-hidden">
      {settings.glyphRain ? (
        <GlyphRain
          className="absolute inset-0"
          charset="0123456789:·—+×∞%#<>/\"
          cell={16}
          color={THEME_GLYPHS[settings.theme].color}
          headColor={THEME_GLYPHS[settings.theme].head}
          speed={0.13}
          speedVariance={0.6}
          density={0.06}
          trail={1.15}
          glow={1.35}
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
            dispersion={0.65}
            shine={1.1}
            trigger="click"
          >
            {scene}
          </Ripple>
        </GlyphRain>
      ) : (
        <div className="absolute inset-0">{scene}</div>
      )}

      {/* кнопка настроек на правом краю */}
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="Открыть настройки отображения"
        className="btn-ghost group fixed top-1/2 right-0 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-md border border-r-0 border-line bg-panel/90 py-4 pr-2 pl-3 backdrop-blur-sm"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-fog transition-colors group-hover:text-ember"
          {...stroke}
        >
          <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="17" r="2" />
        </svg>
        <span
          className="font-mono text-[10px] font-medium tracking-[0.3em] text-dim uppercase [writing-mode:vertical-rl] group-hover:text-fog"
        >
          настройки
        </span>
      </button>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onPatch={patchSettings}
        onReset={resetSettings}
        onFont={(id) => patchSettings({ font: id })}
        onSpacing={(v) => patchSettings({ spacing: v })}
        onGlow={(v) => patchSettings({ glow: v })}
        onTheme={(v) => patchSettings({ theme: v })}
      />

      <DateMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSet={setTimer}
        onReset={resetTimer}
        currentTarget={target}
      />
    </div>
  );
}
