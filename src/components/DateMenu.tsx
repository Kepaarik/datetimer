import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  formatTarget,
  formatDuration,
  fromInputs,
  nextNewYear,
  toInputDate,
  toInputTime,
} from "../lib/time";

interface Preset {
  label: string;
  hint: string;
  icon: ReactNode;
  get: () => number;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PRESETS: Preset[] = [
  {
    label: "5 минут",
    hint: "короткий перерыв",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
      </svg>
    ),
    get: () => Date.now() + 5 * 60_000,
  },
  {
    label: "1 час",
    hint: "рабочий спринт",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    get: () => Date.now() + 3_600_000,
  },
  {
    label: "Сутки",
    hint: "до этого же часа",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
      </svg>
    ),
    get: () => Date.now() + 86_400_000,
  },
  {
    label: "Неделя",
    hint: "семь дней",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 9.5h17M8 2.8V6M16 2.8V6" />
      </svg>
    ),
    get: () => Date.now() + 7 * 86_400_000,
  },
  {
    label: "Выходные",
    hint: "до субботы 10:00",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.2A7 7 0 1 0 5 17.5" />
      </svg>
    ),
    get: () => {
      const d = new Date();
      const day = d.getDay();
      const add = (6 - day + 7) % 7 || 7;
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + add,
        10,
        0,
        0,
        0,
      ).getTime();
    },
  },
  {
    label: "Новый год",
    hint: "1 января, 00:00",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
        <path d="M12 3v18M12 3l-2.5 2M12 3l2.5 2M6 21h12M12 8l-4 4h2.2L7 16h10l-3.2-4H16l-4-4Z" />
      </svg>
    ),
    get: () => nextNewYear(),
  },
];

export interface DateMenuProps {
  open: boolean;
  onClose: () => void;
  onSet: (ts: number) => void;
  onReset: () => void;
  currentTarget: number | null;
}

export function DateMenu({
  open,
  onClose,
  onSet,
  onReset,
  currentTarget,
}: DateMenuProps) {
  const defaultDate = useMemo(() => toInputDate(Date.now() + 86_400_000), []);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = () => {
    const ts = fromInputs(date, time);
    if (ts === null) {
      setError("Укажите дату — без неё никак.");
      return;
    }
    if (ts <= Date.now()) {
      setError("Это время уже прошло — выберите дату в будущем.");
      return;
    }
    onSet(ts);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="menu-backdrop"
            className="fixed inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="menu-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Выбор конечной даты"
            className="z-40 w-[min(92vw,400px)] max-sm:fixed max-sm:inset-x-0 max-sm:top-1/2 max-sm:mx-auto max-sm:-translate-y-1/2 sm:absolute sm:left-1/2 sm:top-full sm:mt-6 sm:-translate-x-1/2"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-h-[min(66vh,600px)] overflow-y-auto overflow-x-hidden rounded-lg border border-line bg-panel/95 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-ember" {...stroke}>
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                    <path d="M3.5 9.5h17M8 2.8V6M16 2.8V6M8 13.5h2M14 13.5h2M8 17h2" />
                  </svg>
                  <span className="font-display text-[11px] font-medium tracking-[0.18em] text-ink uppercase">
                    До какой даты считаем?
                  </span>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть меню"
                  className="btn-ghost -mr-1.5 rounded-md border border-transparent p-1.5 text-fog hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {currentTarget && (
                <div className="flex items-center justify-between gap-3 border-b border-line bg-deep px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
                      Текущая цель
                    </div>
                    <div className="truncate text-sm font-medium text-lagoon">
                      {formatTarget(currentTarget)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onReset();
                    }}
                    className="btn-ghost shrink-0 rounded-md border border-line px-3 py-1.5 font-mono text-[11px] tracking-wider text-fog uppercase hover:text-alarm"
                  >
                    Сбросить
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => onSet(p.get())}
                    className="preset-btn flex flex-col items-start gap-1.5 rounded-md border border-line bg-deep px-3 py-2.5 text-left"
                  >
                    <span className="flex w-full items-center justify-between text-ember">
                      {p.icon}
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-dim" {...stroke}>
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </span>
                    <span className="text-[13px] leading-tight font-semibold text-ink">
                      {p.label}
                    </span>
                    <span className="text-[10.5px] leading-tight text-dim">
                      {p.hint}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-line px-4 py-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] tracking-[0.22em] text-dim uppercase">
                    Своя дата и время
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={date}
                    min={toInputDate(Date.now())}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setError(null);
                    }}
                    aria-label="Конечная дата"
                    className="min-w-0 flex-1 rounded-md border border-line bg-deep px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors focus:border-flare/70"
                  />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      setError(null);
                    }}
                    aria-label="Конечное время"
                    className="w-[104px] shrink-0 rounded-md border border-line bg-deep px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors focus:border-flare/70"
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-1.5 text-[12px] text-alarm"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" {...stroke}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7.5V13M12 16.4v.1" />
                    </svg>
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={submit}
                  className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-flare/50 bg-flare/15 px-4 py-2.5 font-display text-[12px] font-semibold tracking-[0.14em] text-ember uppercase"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
                    <path d="M12 21a9 9 0 1 1 9-9" />
                    <path d="M12 7v5l3 2M21 3l-4 4M17 3h4v4" />
                  </svg>
                  Запустить отсчёт
                </button>

                {currentTarget && (
                  <p className="mt-2.5 text-center font-mono text-[11px] text-dim">
                    останется{" "}
                    <span className="text-fog">
                      {formatDuration(currentTarget - Date.now())}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="pointer-events-none mx-auto -mt-px h-2 w-24 rounded-b-full bg-flare/25 blur-md" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
