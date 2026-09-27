import type { PlanItem } from "./constants";

// Reja jadvalidagi input (maydon) ta'rifi. Standart maydonlar (`builtin`) bazadagi
// plan_items ustunlariga yoziladi; qo'shimcha maydonlar qiymati brauzerda saqlanadi.
export type BuiltinKey = keyof Omit<PlanItem, "source">;
export type FieldDef = { id: string; label: string; builtin?: BuiltinKey };
export type ExtraValues = Record<string, Record<string, string>>; // kun -> maydon id -> qiymat

export const PLACEHOLDERS: Record<BuiltinKey, string> = {
  topic: "Mavzu nomi",
  material: "Masalan, Cambridge 17",
  pages: "24-27",
  homework: "Vazifa",
};

// Uy vazifasi alohida sahifada (/homework) yuritiladi — reja jadvalida ko'rsatilmaydi.


export const DEFAULT_FIELDS: FieldDef[] = [
  { id: "topic", label: "Mavzu", builtin: "topic" },
  { id: "material", label: "Kitob / fayl", builtin: "material" },
  { id: "pages", label: "Betlar", builtin: "pages" },
];

const fieldsKey = (groupId: string) => `plan-fields:${groupId}`;
const extraKey = (groupId: string, weekStart: string) => `plan-extra:${groupId}:${weekStart}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // saqlab bo'lmasa (masalan, maxfiy rejim) — sozlama shu sessiya bilan cheklanadi
  }
}

export type FieldsByDay = Record<string, FieldDef[]>;

const withoutHomework = (fields: FieldDef[]) => fields.filter((f) => f.builtin !== "homework");

// Har bir kun ustuni o'z maydonlariga ega. Eski format (barcha kunlar uchun bitta ro'yxat)
// bo'lsa, u barcha kunlarga nusxalanadi.
export function loadFields(groupId: string, days: readonly string[]): FieldsByDay {
  const saved = read<FieldsByDay | FieldDef[] | null>(fieldsKey(groupId), null);
  const out: FieldsByDay = {};
  for (const day of days) {
    const own = Array.isArray(saved) ? saved : saved?.[day];
    out[day] = Array.isArray(own) ? withoutHomework(own) : DEFAULT_FIELDS;
  }
  return out;
}

export function saveFields(groupId: string, fields: FieldsByDay) {
  write(fieldsKey(groupId), fields);
}

export function loadExtra(groupId: string, weekStart: string): ExtraValues {
  return read<ExtraValues>(extraKey(groupId, weekStart), {});
}

export function saveExtra(groupId: string, weekStart: string, values: ExtraValues) {
  write(extraKey(groupId, weekStart), values);
}

export function newFieldId(): string {
  return `x_${Math.random().toString(36).slice(2, 9)}`;
}
