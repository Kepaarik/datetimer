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

export const DEFAULT_SETTINGS: TimerSettings = {
  sizeScale: 1,
  font: "unbounded",
  tracking: "normal",
  glow: "soft",
  glitch: true,
  rain: true,
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
            "absolute top-0.5 h-4 w-4 rounded-full bg-abyss transition-all duration-200",
            checked ? "left-[18px]" : "left-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: TimerSettings;
  onChange: (patch: Partial<TimerSettings>) => void;
  onReset: () => void;
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  onReset,
}: SettingsPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pct = Math.round(settings.sizeScale * 100);

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
            aria-label="Кастомизация таймера"
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(88vw,330px)] overflow-y-auto border-l border-line bg-panel/95 shadow-[-30px_0_80px_rgba(0,0,0,0.5)] backdrop-blur-md"
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ember" {...stroke}>
                  <path d="M4 6h9M19 6h1M4 12h1M11 12h9M4 18h13" />
                  <circle cx="16" cy="6" r="2" />
                  <circle cx="8" cy="12" r="2" />
                  <circle cx="20" cy="18" r="2" />
                </svg>
                <span className="font-display text-[11px] font-medium tracking-[0.18em] text-ink uppercase">
                  Кастомизация
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

            <div className="space-y-6 px-5 py-5">
              {/* высота цифр */}
              <section>
                <SectionTitle>Высота цифр</SectionTitle>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={150}
                    step={5}
                    value={pct}
                    onChange={(e) =>
                      onChange({ sizeScale: Number(e.target.value) / 100 })
                    }
                    aria-label="Высота цифр в процентах"
                    className="h-1 min-w-0 flex-1 cursor-pointer"
                  />
                  <span className="w-12 shrink-0 text-right font-mono text-[13px] text-ember tabular-nums">
                    {pct}%
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] tracking-wider text-dim">
                  от базового размера, подобранного под экран
                </p>
              </section>

              {/* шрифт */}
              <section>
                <SectionTitle>Шрифт цифр</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onChange({ font: f.id })}
                      className={[
                        "preset-btn cursor-pointer rounded-md border px-3 py-2.5 text-left",
                        settings.font === f.id
                          ? "border-ember/60 bg-raise"
                          : "border-line bg-deep",
                      ].join(" ")}
                    >
                      <span
                        className="block text-[21px] leading-none text-ink"
                        style={{ fontFamily: f.family }}
                      >
                        07:59
                      </span>
                      <span className="mt-2 block font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* интервал */}
              <section>
                <SectionTitle>Межбуквенный интервал</SectionTitle>
                <Segmented
                  value={settings.tracking}
                  onChange={(tracking) => onChange({ tracking })}
                  options={[
                    { id: "tight", label: "Узкий" },
                    { id: "normal", label: "Средний" },
                    { id: "wide", label: "Широкий" },
                  ]}
                />
              </section>

              {/* свечение */}
              <section>
                <SectionTitle>Свечение</SectionTitle>
                <Segmented
                  value={settings.glow}
                  onChange={(glow) => onChange({ glow })}
                  options={[
                    { id: "off", label: "Выкл" },
                    { id: "soft", label: "Среднее" },
                    { id: "strong", label: "Яркое" },
                  ]}
                />
              </section>

              {/* эффекты */}
              <section>
                <SectionTitle>Эффекты</SectionTitle>
                <div className="space-y-2">
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
                    hint="падающие глифы на канвасе"
                  />
                </div>
              </section>
            </div>

            <div className="border-t border-line px-5 py-4">
              <button
                onClick={onReset}
                className="btn-ghost flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-deep px-4 py-2.5 font-display text-[11px] font-semibold tracking-[0.16em] text-fog uppercase"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...stroke}>
                  <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
                  <path d="M3.5 3.5v5h5" />
                </svg>
                Сбросить всё
              </button>
              <p className="mt-2.5 text-center font-mono text-[10px] tracking-wider text-dim">
                настройки сохраняются автоматически
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
