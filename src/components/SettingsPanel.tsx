import { useEffect, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Glow } from "./TimerDigits";
import type { AsciiShape } from "./AsciiObject";

export type ThemeId = "steel" | "ember" | "lagoon" | "paper";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const FONT_OPTIONS: { id: string; label: string; css: string }[] = [
  {
    id: "unbounded",
    label: "Unbounded",
    css: '"Unbounded", "Golos Text", system-ui, sans-serif',
  },
  { id: "orbitron", label: "Orbitron", css: '"Orbitron", "Unbounded", sans-serif' },
  { id: "russo", label: "Russo One", css: '"Russo One", "Unbounded", sans-serif' },
  {
    id: "mono",
    label: "JetBrains Mono",
    css: '"JetBrains Mono", ui-monospace, monospace',
  },
];

export const THEMES: { id: ThemeId; label: string; sw: [string, string, string] }[] = [
  { id: "steel", label: "Сталь", sw: ["#0a0c0f", "#e7ecf1", "#f59a23"] },
  { id: "ember", label: "Уголь", sw: ["#150f09", "#f3e9dc", "#ff9a23"] },
  { id: "lagoon", label: "Лагуна", sw: ["#060d10", "#e6f4f2", "#3fd6c0"] },
  { id: "paper", label: "Бумага", sw: ["#dfe4e8", "#141a21", "#0fa396"] },
];

export interface TimerSettings {
  scale: number;
  font: string;
  spacing: "tight" | "normal" | "wide";
  glow: Glow;
  glitch: boolean;
  glyphRain: boolean;
  theme: ThemeId;
  /** параллельные потоки глиф-дождя, 1–3 */
  rainLayers: number;
  /** доля новых капель за цикл падения, 0.05–0.6 */
  rainDensity: number;
  /** рябь на кликах (Canvas UI Ripple) */
  ripple: boolean;
  /** расшифровка заголовка глитч-глифами */
  scramble: boolean;
  /** кольцо, расходящееся от таймера каждую секунду */
  tickPulse: boolean;
  /** восходящие искры на фоне */
  embers: boolean;
  /** падающий снег на фоне */
  snow: boolean;
  /** затухающий след за курсором */
  cursorTrail: boolean;
  /** блуждающие мерцающие огоньки */
  fireflies: boolean;
  /** мерцающие звёзды с параллаксом */
  starfield: boolean;
  /** периодические падающие метеоры */
  meteors: boolean;
  /** косой ливень */
  raindrops: boolean;
  /** вращающийся 3D-объект из ASCII-символов */
  ascii: boolean;
  asciiShape: AsciiShape;
  /** размер ASCII-объекта в процентах, 60–160 */
  asciiSize: number;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  scale: 100,
  font: "unbounded",
  spacing: "normal",
  glow: "soft",
  glitch: true,
  glyphRain: true,
  theme: "steel",
  rainLayers: 2,
  rainDensity: 0.06,
  ripple: true,
  scramble: true,
  tickPulse: true,
  embers: false,
  snow: false,
  cursorTrail: false,
  fireflies: false,
  starfield: false,
  meteors: false,
  raindrops: false,
  ascii: true,
  asciiShape: "duck",
  asciiSize: 100,
};

export const ASCII_SHAPES: { id: AsciiShape; label: string }[] = [
  { id: "duck", label: "Утка" },
  { id: "torus", label: "Донат" },
  { id: "sphere", label: "Сфера" },
  { id: "cube", label: "Куб" },
];

interface Props {
  open: boolean;
  settings: TimerSettings;
  onClose: () => void;
  onPatch: (patch: Partial<TimerSettings>) => void;
  onReset: () => void;
  onFont: (id: string) => void;
  onSpacing: (v: TimerSettings["spacing"]) => void;
  onGlow: (v: Glow) => void;
  onTheme: (v: ThemeId) => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="font-mono text-[9.5px] font-medium tracking-[0.26em] text-dim uppercase">
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        {value && (
          <span className="font-mono text-[11px] text-ember tabular-nums">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="group flex w-full items-center justify-between gap-3 rounded-md border border-line bg-deep px-3 py-2.5 text-left transition-colors hover:border-linehi"
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        <span className="block text-[10.5px] leading-snug text-dim">{hint}</span>
      </span>
      <span
        className={[
          "relative h-[18px] w-[34px] shrink-0 rounded-full border transition-colors",
          on ? "border-flare/60 bg-flare/30" : "border-line bg-raise",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all duration-200",
            on ? "left-[18px] bg-ember" : "left-[3px] bg-dim",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function MiniToggle({
  on,
  onToggle,
  label,
  icon,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={label}
      onClick={onToggle}
      className={[
        "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all",
        on
          ? "border-flare/60 bg-flare/10 shadow-[0_0_16px_rgba(245,154,35,0.1)]"
          : "border-line bg-deep hover:border-linehi",
      ].join(" ")}
    >
      <span className={["shrink-0", on ? "text-ember" : "text-dim"].join(" ")}>
        {icon}
      </span>
      <span
        className={[
          "flex-1 text-[11px] leading-tight font-medium",
          on ? "text-ink" : "text-fog",
        ].join(" ")}
      >
        {label}
      </span>
      <span
        className={[
          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
          on ? "bg-ember shadow-[0_0_8px_rgba(245,154,35,0.9)]" : "bg-dim/40",
        ].join(" ")}
      />
    </button>
  );
}

const fxIcon = {
  glitch: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M3 12h4l2-5 3.5 10 2-5H21" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9" />
    </svg>
  ),
  ripple: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="6.5" strokeDasharray="3 4" />
      <circle cx="12" cy="12" r="10" strokeDasharray="2 5" opacity="0.6" />
    </svg>
  ),
  scramble: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M9 4 7 20M17 4l-2 16M4 9h16M4 15h16" />
    </svg>
  ),
  embers: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M12 3c.8 3.2-3.5 4.6-3.5 8.4a3.9 3.9 0 0 0 7.8 0c0-1.6-.7-2.8-1.5-3.9-.3 1.2-1.8 1.6-1.8.1C13 6.1 13.9 4.6 12 3Z" />
      <path d="M8 21h8" />
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
    </svg>
  ),
  trail: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M5 4l6.5 15 2-6.5L20 10.5 5 4Z" />
      <path d="M3 17h3M4 21h5" opacity="0.6" />
    </svg>
  ),
  firefly: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.4 1.4M15.6 15.6 17 17M17 7l-1.4 1.4M8.4 15.6 7 17" opacity="0.7" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z" opacity="0.6" />
    </svg>
  ),
  meteor: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M21 3 9.5 14.5" />
      <path d="M17.5 3.5 13 8M20.5 7 16 11.5" opacity="0.6" />
      <circle cx="7.5" cy="16.5" r="4" />
    </svg>
  ),
  raindrop: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <path d="M8 3 5 10M14 3l-3 7M20 3l-3 7M10 12l-3 7M16 12l-3 7M22 12l-3 7" />
    </svg>
  ),
  ascii: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
      <ellipse cx="12" cy="12" rx="9" ry="4.5" />
      <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(60 12 12)" opacity="0.55" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  ),
};

const SPACINGS: { id: TimerSettings["spacing"]; label: string; ls: string }[] = [
  { id: "tight", label: "Узкий", ls: "-0.03em" },
  { id: "normal", label: "Средний", ls: "0em" },
  { id: "wide", label: "Широкий", ls: "0.06em" },
];

const GLOWS: { id: Glow; label: string }[] = [
  { id: "off", label: "Выкл" },
  { id: "soft", label: "Среднее" },
  { id: "strong", label: "Яркое" },
];

export function SettingsPanel({
  open,
  settings,
  onClose,
  onPatch,
  onReset,
  onFont,
  onSpacing,
  onGlow,
  onTheme,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const seg = (active: boolean) =>
    [
      "flex-1 rounded border px-2 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors",
      active
        ? "border-flare/60 bg-flare/15 text-ember"
        : "border-line bg-deep text-fog hover:border-linehi hover:text-ink",
    ].join(" ");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="settings-backdrop"
            type="button"
            aria-label="Закрыть настройки"
            className="fixed inset-0 z-40 cursor-default bg-abyss/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.aside
            key="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Настройки отображения"
            className="fixed top-0 right-0 bottom-0 z-50 flex w-[min(88vw,330px)] flex-col border-l border-line bg-panel/95 shadow-[-30px_0_80px_rgba(0,0,0,0.5)] backdrop-blur-sm"
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ember" {...stroke}>
                  <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
                  <circle cx="15" cy="7" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="15" cy="17" r="2" />
                </svg>
                <span className="font-display text-[11px] font-medium tracking-[0.18em] text-ink uppercase">
                  Настройки
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="btn-ghost -mr-1 rounded-md border border-transparent p-1.5 text-fog hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <Row label="Высота цифр" value={`${settings.scale}%`}>
                <input
                  type="range"
                  min={60}
                  max={150}
                  step={5}
                  value={settings.scale}
                  onChange={(e) => onPatch({ scale: Number(e.target.value) })}
                  className="w-full cursor-pointer"
                  aria-label="Высота цифр, процентов"
                />
                <div className="mt-1 flex justify-between font-mono text-[9px] text-dim">
                  <span>60%</span>
                  <span>150%</span>
                </div>
              </Row>

              <div>
                <div className="mb-2">
                  <SectionLabel>Шрифт цифр</SectionLabel>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={settings.font === f.id}
                      onClick={() => onFont(f.id)}
                      className={[
                        "rounded-md border px-3 py-2.5 text-left transition-all",
                        settings.font === f.id
                          ? "border-flare/60 bg-flare/10 shadow-[0_0_18px_rgba(245,154,35,0.12)]"
                          : "border-line bg-deep hover:border-linehi",
                      ].join(" ")}
                    >
                      <span
                        className="block text-[19px] leading-none text-ink"
                        style={{ fontFamily: f.css } as CSSProperties}
                      >
                        07:59
                      </span>
                      <span className="mt-1.5 block font-mono text-[9.5px] tracking-wider text-dim uppercase">
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2">
                  <SectionLabel>Тема сайта</SectionLabel>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={settings.theme === t.id}
                      onClick={() => onTheme(t.id)}
                      className={[
                        "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-all",
                        settings.theme === t.id
                          ? "border-flare/60 bg-flare/10 shadow-[0_0_18px_rgba(245,154,35,0.12)]"
                          : "border-line bg-deep hover:border-linehi",
                      ].join(" ")}
                    >
                      <span className="flex shrink-0 -space-x-1">
                        {t.sw.map((c) => (
                          <span
                            key={c}
                            className="h-3.5 w-3.5 rounded-full border border-black/30"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      <span className="text-[12px] font-medium text-ink">
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Row label="Межбуквенный интервал">
                <div className="flex gap-1.5">
                  {SPACINGS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={settings.spacing === s.id}
                      onClick={() => onSpacing(s.id)}
                      className={seg(settings.spacing === s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Свечение цифр">
                <div className="flex gap-1.5">
                  {GLOWS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={settings.glow === g.id}
                      onClick={() => onGlow(g.id)}
                      className={seg(settings.glow === g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </Row>

              <div>
                <div className="mb-2">
                  <SectionLabel>Эффекты</SectionLabel>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniToggle
                    on={settings.glitch}
                    onToggle={() => onPatch({ glitch: !settings.glitch })}
                    label="Глитч-сбои"
                    icon={fxIcon.glitch}
                  />
                  <MiniToggle
                    on={settings.tickPulse}
                    onToggle={() => onPatch({ tickPulse: !settings.tickPulse })}
                    label="Пульс секунд"
                    icon={fxIcon.pulse}
                  />
                  <MiniToggle
                    on={settings.ripple}
                    onToggle={() => onPatch({ ripple: !settings.ripple })}
                    label="Рябь кликов"
                    icon={fxIcon.ripple}
                  />
                  <MiniToggle
                    on={settings.scramble}
                    onToggle={() => onPatch({ scramble: !settings.scramble })}
                    label="Скрэмбл текста"
                    icon={fxIcon.scramble}
                  />
                  <MiniToggle
                    on={settings.embers}
                    onToggle={() => onPatch({ embers: !settings.embers })}
                    label="Искры"
                    icon={fxIcon.embers}
                  />
                  <MiniToggle
                    on={settings.snow}
                    onToggle={() => onPatch({ snow: !settings.snow })}
                    label="Снег"
                    icon={fxIcon.snow}
                  />
                  <MiniToggle
                    on={settings.cursorTrail}
                    onToggle={() =>
                      onPatch({ cursorTrail: !settings.cursorTrail })
                    }
                    label="След курсора"
                    icon={fxIcon.trail}
                  />
                  <MiniToggle
                    on={settings.fireflies}
                    onToggle={() => onPatch({ fireflies: !settings.fireflies })}
                    label="Огоньки"
                    icon={fxIcon.firefly}
                  />
                  <MiniToggle
                    on={settings.starfield}
                    onToggle={() => onPatch({ starfield: !settings.starfield })}
                    label="Звёзды"
                    icon={fxIcon.star}
                  />
                  <MiniToggle
                    on={settings.meteors}
                    onToggle={() => onPatch({ meteors: !settings.meteors })}
                    label="Метеоры"
                    icon={fxIcon.meteor}
                  />
                  <MiniToggle
                    on={settings.raindrops}
                    onToggle={() => onPatch({ raindrops: !settings.raindrops })}
                    label="Дождь"
                    icon={fxIcon.raindrop}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <SectionLabel>Глиф-дождь</SectionLabel>
                <Toggle
                  on={settings.glyphRain}
                  onChange={(v) => onPatch({ glyphRain: v })}
                  label="Дождь из глифов"
                  hint="падающие символы на фоне"
                />
                <div
                  className={[
                    "space-y-4 transition-opacity duration-200",
                    settings.glyphRain ? "opacity-100" : "pointer-events-none opacity-35",
                  ].join(" ")}
                >
                  <Row
                    label="Количество потоков"
                    value={`×${settings.rainLayers}`}
                  >
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={1}
                      value={settings.rainLayers}
                      onChange={(e) =>
                        onPatch({ rainLayers: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                      aria-label="Количество потоков глифов"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-dim">
                      <span>1 слой</span>
                      <span>2 слоя</span>
                      <span>3 слоя</span>
                    </div>
                  </Row>
                  <Row
                    label="Плотность глифов"
                    value={`${Math.round(settings.rainDensity * 100)}%`}
                  >
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={1}
                      value={Math.round(settings.rainDensity * 100)}
                      onChange={(e) =>
                        onPatch({ rainDensity: Number(e.target.value) / 100 })
                      }
                      className="w-full cursor-pointer"
                      aria-label="Плотность глифов, процентов"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-dim">
                      <span>редко</span>
                      <span>густо</span>
                    </div>
                  </Row>
                </div>
              </div>

              <div className="space-y-4">
                <SectionLabel>ASCII-объект</SectionLabel>
                <Toggle
                  on={settings.ascii}
                  onChange={(v) => onPatch({ ascii: v })}
                  label="3D-фигура из символов"
                  hint="вращается за таймером, реагирует на курсор"
                />
                <div
                  className={[
                    "space-y-4 transition-opacity duration-200",
                    settings.ascii ? "opacity-100" : "pointer-events-none opacity-35",
                  ].join(" ")}
                >
                  <Row label="Форма">
                    <div className="grid grid-cols-4 gap-1.5">
                      {ASCII_SHAPES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={settings.asciiShape === s.id}
                          onClick={() => onPatch({ asciiShape: s.id })}
                          className={seg(settings.asciiShape === s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Row>
                  <Row label="Размер объекта" value={`${settings.asciiSize}%`}>
                    <input
                      type="range"
                      min={60}
                      max={160}
                      step={5}
                      value={settings.asciiSize}
                      onChange={(e) =>
                        onPatch({ asciiSize: Number(e.target.value) })
                      }
                      className="w-full cursor-pointer"
                      aria-label="Размер ASCII-объекта, процентов"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-dim">
                      <span>60%</span>
                      <span>160%</span>
                    </div>
                  </Row>
                </div>
              </div>
            </div>

            <div className="border-t border-line px-5 py-4">
              <button
                onClick={onReset}
                className="btn-ghost flex w-full items-center justify-center gap-2 rounded-md border border-line bg-deep px-4 py-2.5 font-display text-[11px] font-medium tracking-[0.16em] text-fog uppercase hover:text-alarm"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
                  <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
                  <path d="M3.5 3.5v5h5" />
                </svg>
                Сбросить всё
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
