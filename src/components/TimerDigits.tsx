import { memo } from "react";
import { plural } from "../lib/time";

function Digit({ char, index }: { char: string; index: number }) {
  return (
    <span className="digit-cell">
      <span key={`${index}-${char}`} className="digit-roll">
        {char}
      </span>
    </span>
  );
}

export function NumberRow({ value, width }: { value: string; width?: number }) {
  const chars = value.padStart(width ?? value.length, "0").split("");
  return (
    <span className="inline-flex" aria-hidden="true">
      {chars.map((c, i) => (
        <Digit key={i} char={c} index={i} />
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
  tickKey?: string | number;
}

/** Число + подписанное существительное в правильном падеже. */
export function Unit({
  value,
  minDigits = 2,
  forms,
  valueLabel,
  alarm,
  tickKey,
}: UnitProps) {
  const word = plural(value, forms);
  const text = String(value).padStart(minDigits, "0");
  return (
    <div className="group flex min-w-0 flex-col items-center gap-2 sm:gap-3">
      <span
        className={[
          "font-display leading-none font-semibold tracking-tight tabular-nums",
          alarm ? "text-alarm timer-glow-alarm" : "text-ember timer-glow",
        ].join(" ")}
      >
        <NumberRow value={text} width={minDigits} />
      </span>
      <span
        key={tickKey ?? word}
        className={[
          "label-tick font-mono text-[10px] font-medium tracking-[0.22em] uppercase sm:text-[11px]",
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
        "colon-blink font-display pb-5 text-2xl leading-none font-light sm:pb-7 sm:text-4xl",
        alarm ? "text-alarm/60" : "text-linehi",
      ].join(" ")}
      aria-hidden="true"
    >
      :
    </span>
  );
}

export const TimerDigits = memo(function TimerDigits({
  days,
  hours,
  minutes,
  seconds,
  alarm,
  sizeClass,
}: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  alarm?: boolean;
  sizeClass: string;
}) {
  return (
    <div
      className={[
        "flex items-start justify-center gap-2 sm:gap-4",
        sizeClass,
      ].join(" ")}
      role="timer"
      aria-live="off"
    >
      <Unit
        value={days}
        minDigits={days > 99 ? 3 : 2}
        forms={["день", "дня", "дней"]}
        valueLabel="дни"
        alarm={alarm}
      />
      <Colon alarm={alarm} />
      <Unit
        value={hours}
        forms={["час", "часа", "часов"]}
        valueLabel="часы"
        alarm={alarm}
      />
      <Colon alarm={alarm} />
      <Unit
        value={minutes}
        forms={["минута", "минуты", "минут"]}
        valueLabel="минуты"
        alarm={alarm}
      />
      <Colon alarm={alarm} />
      <Unit
        value={seconds}
        forms={["секунда", "секунды", "секунд"]}
        valueLabel="секунды"
        alarm={alarm}
        tickKey={seconds}
      />
    </div>
  );
});
