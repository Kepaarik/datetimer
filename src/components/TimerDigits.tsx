import { Fragment, memo, type CSSProperties } from "react";
import {
  DAY_FORMS,
  HOUR_FORMS,
  MINUTE_FORMS,
  SECOND_FORMS,
  plural,
} from "../lib/time";

export type Glow = "off" | "soft" | "strong";

function Digit({ char }: { char: string }) {
  return (
    <span className="digit-cell">
      <span key={char} className="digit-roll">
        {char}
      </span>
    </span>
  );
}

export function NumberRow({ value, width }: { value: string; width: number }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      {value
        .padStart(width, "0")
        .split("")
        .map((c, i) => (
          <Digit key={i} char={c} />
        ))}
    </span>
  );
}

interface UnitProps {
  value: number;
  minDigits?: number;
  forms: [string, string, string];
  valueLabel: string;
  alarm?: boolean;
  glow: Glow;
  tickKey?: string | number;
}

/** Число + подписанное существительное в правильном падеже. */
export function Unit({
  value,
  minDigits = 2,
  forms,
  valueLabel,
  alarm,
  glow,
  tickKey,
}: UnitProps) {
  const word = plural(value, forms);
  const text = String(value).padStart(minDigits, "0");

  const numCls = alarm
    ? glow === "off"
      ? "text-alarm"
      : glow === "strong"
        ? "text-alarm timer-glow-alarm-strong"
        : "text-alarm timer-glow-alarm"
    : glow === "off"
      ? "text-ink"
      : glow === "strong"
        ? "text-ink timer-glow-strong"
        : "text-ink timer-glow";

  return (
    <div className="group flex min-w-0 flex-col items-center gap-[0.14em] sm:gap-[0.16em]">
      <span
        className={[
          "leading-none font-semibold tabular-nums",
          numCls,
        ].join(" ")}
      >
        <NumberRow value={text} width={minDigits} />
      </span>
      <span
        key={tickKey ?? word}
        className={[
          "label-tick font-mono text-[10px] font-medium tracking-[0.3em] uppercase sm:text-[12px]",
          alarm ? "text-alarm/80" : "text-fog",
        ].join(" ")}
      >
        {word}
      </span>
      <span className="sr-only">
        {value} {word} ({valueLabel})
      </span>
    </div>
  );
}

export function Colon({ alarm }: { alarm?: boolean }) {
  return (
    <span
      className={[
        "colon-blink pb-[0.4em] text-[0.5em] leading-none font-light",
        alarm ? "text-alarm/60" : "text-ember",
      ].join(" ")}
      aria-hidden="true"
    >
      :
    </span>
  );
}

interface TimerDigitsProps {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  alarm?: boolean;
  glitching?: boolean;
  glow?: Glow;
  /** CSS-значение font-size, например min(23vw,19vh,10rem) */
  fontSize: string;
  fontFamily?: string;
  letterSpacing?: string;
  /** дополнительные классы (например opacity-60) */
  sizeClass?: string;
}

export const TimerDigits = memo(function TimerDigits({
  days,
  hours,
  minutes,
  seconds,
  alarm,
  glitching,
  glow = "soft",
  fontSize,
  fontFamily,
  letterSpacing,
  sizeClass = "",
}: TimerDigitsProps) {
  const units = [
    {
      id: "days",
      value: days,
      minDigits: days > 99 ? 3 : 2,
      forms: DAY_FORMS,
      valueLabel: "дни",
    },
    {
      id: "hours",
      value: hours,
      minDigits: 2,
      forms: HOUR_FORMS,
      valueLabel: "часы",
    },
    {
      id: "minutes",
      value: minutes,
      minDigits: 2,
      forms: MINUTE_FORMS,
      valueLabel: "минуты",
    },
    {
      id: "seconds",
      value: seconds,
      minDigits: 2,
      forms: SECOND_FORMS,
      valueLabel: "секунды",
    },
  ];

  /* незначащие нули не показываем: начинаем с первой ненулевой
     единицы, но не правее минут — «00 : 07» остаётся всегда */
  const firstNonZero = units.findIndex((u) => u.value > 0);
  const start =
    firstNonZero === -1
      ? units.length - 2
      : Math.min(firstNonZero, units.length - 2);
  const visible = units.slice(start);

  const style: CSSProperties = { fontSize, fontFamily, letterSpacing };

  return (
    <div
      className={[
        "flex items-center justify-center gap-[0.14em] sm:gap-[0.26em]",
        sizeClass,
        glitching ? "glitching" : "",
      ].join(" ")}
      style={style}
      role="timer"
      aria-live="off"
    >
      {visible.map((u, i) => (
        <Fragment key={u.id}>
          {i > 0 && <Colon alarm={alarm} />}
          <Unit
            value={u.value}
            minDigits={u.minDigits}
            forms={u.forms}
            valueLabel={u.valueLabel}
            alarm={alarm}
            glow={glow}
            tickKey={u.id === "seconds" ? u.value : undefined}
          />
        </Fragment>
      ))}
    </div>
  );
});
