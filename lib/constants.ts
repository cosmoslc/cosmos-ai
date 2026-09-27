export const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"] as const;
export type DayName = (typeof DAYS)[number];

// Guruhning dars kunlari (asosiy CRM'dagi groups.days) — hafta tartibida.
// Bo'sh yoki noma'lum bo'lsa, barcha kunlar qaytariladi.
export function lessonDaysOf(days: string[] | null | undefined): DayName[] {
  const set = new Set((days ?? []).map((d) => d.trim().toLowerCase()));
  const picked = DAYS.filter((d) => set.has(d.toLowerCase()));
  return picked.length > 0 ? picked : [...DAYS];
}

export type PlanItem = {
  topic: string;
  material: string;
  pages: string;
  homework: string;
  source: "ai" | "manual" | "";
};

export function emptyPlanItem(): PlanItem {
  return { topic: "", material: "", pages: "", homework: "", source: "" };
}
