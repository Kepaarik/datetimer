/** Русская плюрализация: 1 день, 2 дня, 5 дней. */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];
export const HOUR_FORMS: [string, string, string] = ["час", "часа", "часов"];
export const MINUTE_FORMS: [string, string, string] = [
  "минута",
  "минуты",
  "минут",
];
export const SECOND_FORMS: [string, string, string] = [
  "секунда",
  "секунды",
  "секунд",
];

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export function splitRemaining(ms: number): Remaining {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

const targetFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const targetShortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const clockFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatTarget(ts: number): string {
  return targetFmt.format(new Date(ts));
}

export function formatTargetShort(ts: number): string {
  return targetShortFmt.format(new Date(ts));
}

export function formatClock(ts: number): string {
  return clockFmt.format(new Date(ts));
}

/** Человекочитаемая длительность: «3 дня 4 часа» / «2 часа 15 минут»… */
export function formatDuration(ms: number): string {
  const r = splitRemaining(ms);
  const parts: string[] = [];
  if (r.days > 0) parts.push(`${r.days} ${plural(r.days, DAY_FORMS)}`);
  if (r.hours > 0) parts.push(`${r.hours} ${plural(r.hours, HOUR_FORMS)}`);
  if (r.days === 0 && r.minutes > 0)
    parts.push(`${r.minutes} ${plural(r.minutes, MINUTE_FORMS)}`);
  if (r.days === 0 && r.hours === 0 && r.seconds > 0 && r.minutes < 10)
    parts.push(`${r.seconds} ${plural(r.seconds, SECOND_FORMS)}`);
  return parts.length ? parts.join(" ") : "меньше секунды";
}

/** Ближайшее 1 января 00:00 (локальное время). */
export function nextNewYear(): number {
  const now = new Date();
  return new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0).getTime();
}

export function toInputDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toInputTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputs(date: string, time: string): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = (time || "00:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}
