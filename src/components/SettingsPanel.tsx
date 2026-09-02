import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type FontId = "unbounded" | "orbitron" | "russo" | "mono";
export type Tracking = "tight" | "normal" | "wide";
export type Glow = "off" | "soft" | "strong";
export type ThemeId = "graphite" | "night" | "ember" | "paper";

export interface TimerSettings {
  /** Множитель высоты цифр, 0.6–1.5. */
  sizeScale: number;
  font: FontId;
  tracking: Tracking;
  glow: Glow;
  /** Глитч-сбои, полосы помех и VHS-полоса. */
  glitch: boolean;
  /** Канвас-слой с падающими глифами. */
  rain: boolean;
  theme: ThemeId;
}

export const FONTS: { id: FontId; label: string; family: string }[] = [
  { id: "unbounded", label: "Unbounded", family: '"Unbounded", sans-serif' },
  { id: "orbitron", label: "Orbitron", family: '"Orbitron", sans-serif' },
  { id: "russo", label: "Russo One", family: '"Russo One", sans-serif' },
  { id: "mono", label: "JetBrains Mono", family: '"JetBrains Mono", monospace' },
];

export const TRACKING_VALUES: Record<Tracking, string> = {
  tight: "-0.03em",
  normal: "0em",
  wide: "0.08em",
};

export const THEMES: {
  id: ThemeId;
  label: string;
  hint: string;
  swatches: [string, string, string, string];
}[] = [
  {
    id: "graphite",
    label: "Графит",
    hint: "сталь и янтарь",
    swatches: ["#0a0c0f", "#232a33", "#e7ecf1", "#f59a23"],
  },
  {
    id: "night",
    label: "Полночь",
    hint: "синь и лёд",
    swatches: ["#05070d", "#1a2536", "#e8f0fb", "#4cc9f0"],
  },
  {
    id: "ember",
    label: "Уголь",
    hint: "тёплый мрак",
    swatches: ["#0f0b08", "#33261b", "#f4ead9", "#ffb45e"],
  },
  {
    id: "paper",
    label: "Бумага",
    hint: "светлый лист",
    swatches: ["#e9ebee", "#d3d9df", "#1b222b", "#d97706"],
  },
];

export const DEFAULT_SETTINGS: TimerSettings = {
  sizeScale: 1,
  font: "unbounded",
  tracking: "normal",
  glow: "soft",
  glitch: true,
  rain: true,
  theme: "graphite",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="h-px flex-1 bg-line" />
      <span className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-line bg-deep p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={[
            "flex-1 cursor-pointer rounded px-2 py-1.5 font-mono text-[10.5px] tracking-wider uppercase transition-all duration-150",
            value === o.id
              ? "bg-raise text-ember shadow-[inset_0_0_0_1px_var(--color-linehi)]"
              : "text-fog hover:text-ink",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="btn-ghost flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-deep px-3 py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight font-semibold text-ink">
          {label}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-tight text-dim">
          {hint}
        </span>
      </span>
      <span
        className={[
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-flare" : "bg-line",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (t: ThemeId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEMES.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={[
              "preset-btn cursor-pointer rounded-md border px-2.5 py-2 text-left",
              active
                ? "border-ember/70 bg-raise shadow-[0_0_18px_rgba(245,154,35,0.12)]"
                : "border-line bg-deep",
            ].join(" ")}
          >
            <span className="flex h-5 w-full overflow-hidden rounded-sm border border-line/60">
              {t.swatches.map((c) => (
                <span key={c} className="h-full flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] leading-tight font-semibold text-ink">
                {t.label}
              </span>
              {active && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ember" {...stroke}>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            <span className="block text-[10px] leading-tight text-dim">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: TimerSettings;
  onChange: (patch: Partial<TimerSettings>) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="settings-backdrop"
            className="fixed inset-0 z-40 bg-abyss/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            key="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Настройки оформления"
            className="fixed top-0 right-0 bottom-0 z-50 flex w-[min(92vw,350px)] flex-col border-l border-line bg-panel/95 shadow-[-30px_0_80px_rgba(0,0,0,0.5)] backdrop-blur-sm"
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ember" {...stroke}>
                  <path d="M4 8h16M4 16h16" />
                  <circle cx="9" cy="8" r="2.2" />
                  <circle cx="15" cy="16" r="2.2" />
                </svg>
                <span className="font-display text-[11px] font-medium tracking-[0.18em] text-ink uppercase">
                  Оформление
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Закрыть настройки"
                className="btn-ghost -mr-1.5 cursor-pointer rounded-md border border-transparent p-1.5 text-fog hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <SectionTitle>Тема сайта</SectionTitle>
              <ThemePicker
                value={settings.theme}
                onChange={(theme) => onChange({ theme })}
              />

              <div className="mt-6">
                <SectionTitle>Высота цифр</SectionTitle>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={150}
                    step={5}
                    value={Math.round(settings.sizeScale * 100)}
                    onChange={(e) => onChange({ sizeScale: Number(e.target.value) / 100 })}
                    className="h-1.5 flex-1 cursor-pointer accent-flare"
                    aria-label="Масштаб высоты цифр"
                  />
                  <span className="w-12 text-right font-mono text-[12px] text-ember tabular-nums">
                    {Math.round(settings.sizeScale * 100)}%
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <SectionTitle>Шрифт цифр</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onChange({ font: f.id })}
                      className={[
                        "preset-btn cursor-pointer rounded-md border px-3 py-2 text-left",
                        settings.font === f.id
                          ? "border-ember/70 bg-raise shadow-[0_0_18px_rgba(245,154,35,0.12)]"
                          : "border-line bg-deep",
                      ].join(" ")}
                    >
                      <span
                        className="block text-[21px] leading-none text-ink"
                        style={{ fontFamily: f.family }}
                      >
                        07:59
                      </span>
                      <span
                        className={[
                          "mt-1.5 block text-[10.5px] tracking-wide",
                          settings.font === f.id ? "text-ember" : "text-fog",
                        ].join(" ")}
                      >
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <SectionTitle>Межбуквенный интервал</SectionTitle>
                <Segmented
                  value={settings.tracking}
                  options={[
                    { id: "tight", label: "Узкий" },
                    { id: "normal", label: "Средний" },
                    { id: "wide", label: "Широкий" },
                  ]}
                  onChange={(tracking) => onChange({ tracking })}
                />
              </div>

              <div className="mt-6">
                <SectionTitle>Свечение цифр</SectionTitle>
                <Segmented
                  value={settings.glow}
                  options={[
                    { id: "off", label: "Выкл" },
                    { id: "soft", label: "Среднее" },
                    { id: "strong", label: "Яркое" },
                  ]}
                  onChange={(glow) => onChange({ glow })}
                />
              </div>

              <div className="mt-6">
                <SectionTitle>Эффекты</SectionTitle>
                <div className="flex flex-col gap-2">
                  <Toggle
                    checked={settings.glitch}
                    onChange={(glitch) => onChange({ glitch })}
                    label="Глитч-сбои"
                    hint="помехи, RGB-расщепление, VHS-полоса"
                  />
                  <Toggle
                    checked={settings.rain}
                    onChange={(rain) => onChange({ rain })}
                    label="Глиф-дождь"
                    hint="канвас-слой с падающими символами"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-line px-5 py-3.5">
              <button
                onClick={() => onChange({ ...DEFAULT_SETTINGS })}
                className="btn-ghost flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-deep px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] text-fog uppercase hover:text-ink"
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
