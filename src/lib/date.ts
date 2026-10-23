import { DEFAULT_TIMEZONE } from "@/lib/config";

export function dateKeyInZone(date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function currentMonthInZone(date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  return dateKeyInZone(date, timeZone).slice(0, 7);
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthDateRange(month: string): { start: string; end: string } {
  if (!isValidMonth(month)) throw new Error("الشهر المحدد غير صالح.");
  const [year, monthNumber] = month.split("-").map(Number);
  const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(finalDay).padStart(2, "0")}` };
}

export function formatDateArabic(dateKey: string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function formatMonthArabic(month: string): string {
  if (!isValidMonth(month)) return month;
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-15T12:00:00.000Z`));
}
