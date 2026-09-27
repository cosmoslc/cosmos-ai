// Sanalar "YYYY-MM-DD" matni sifatida va UTC arifmetikasi bilan ishlanadi —
// shu tufayli server/brauzer vaqt zonasi farqi (masalan UTC+5) sanani siljitmaydi.
import { DAYS } from "./constants";

const TZ = "Asia/Tashkent";

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s));
}

export function addDays(iso: string, n: number): string {
  return new Date(toUtc(iso) + n * 86400000).toISOString().slice(0, 10);
}

// Dushanba = 0 ... Yakshanba = 6
export function weekdayIndex(iso: string): number {
  return (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

// Yakshanba uchun null (reja kunlari faqat Dushanba–Shanba).
export function dayNameOf(iso: string): (typeof DAYS)[number] | null {
  const i = weekdayIndex(iso);
  return i < DAYS.length ? DAYS[i] : null;
}

export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

// ISO vaqt belgisi (masalan due_at) qaysi Toshkent kuniga to'g'ri kelishini qaytaradi.
export function isoOfTimestamp(ts: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}
