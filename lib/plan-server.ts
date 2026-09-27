// Faqat serverda (API route ichida) ishlatiladi.
import { supabaseAi } from "./supabase-ai";
import { DAYS } from "./constants";
import { addDays, dayNameOf, isIsoDate, mondayOf } from "./dates";

export type HistoryEntry = {
  date: string;
  day: string;
  topic: string;
  material: string;
  pages: string;
  homework: string;
};

export type PlannedItem = {
  date: string;
  topic: string;
  file_name?: string;
  pages?: string;
  homework?: string;
  replace?: boolean;
};

export type SaveResult = {
  saved: { date: string; day: string; topic: string }[];
  skipped: { date: string; reason: string }[];
};

// Guruh uchun hozirgacha tuzilgan (va kelgusi) barcha reja yozuvlari, sana bo'yicha.
export async function loadPlanHistory(groupId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabaseAi
    .from("weekly_plans")
    .select("week_start, plan_items(day_of_week, topic, material, pages, homework)")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);

  const out: HistoryEntry[] = [];
  for (const plan of data ?? []) {
    const items = (plan.plan_items ?? []) as {
      day_of_week: string; topic: string | null; material: string | null; pages: string | null; homework: string | null;
    }[];
    for (const it of items) {
      const idx = (DAYS as readonly string[]).indexOf(it.day_of_week);
      if (idx < 0 || (!it.topic?.trim() && !it.homework?.trim())) continue;
      out.push({
        date: addDays(plan.week_start as string, idx),
        day: it.day_of_week,
        topic: it.topic ?? "",
        material: it.material ?? "",
        pages: it.pages ?? "",
        homework: it.homework ?? "",
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Har bir material bo'yicha "qayergacha borilgan"ni hisoblaydi.
export function summarizeCoverage(entries: HistoryEntry[]): string {
  const byMaterial = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    if (!e.material.trim()) continue;
    byMaterial.set(e.material, [...(byMaterial.get(e.material) ?? []), e]);
  }
  if (byMaterial.size === 0) return "Hali birorta material bo'yicha reja tuzilmagan.";

  return [...byMaterial.entries()]
    .map(([material, list]) => {
      const nums = list.flatMap((e) => (e.pages.match(/\d+/g) ?? []).map(Number));
      const maxPage = nums.length ? Math.max(...nums) : null;
      const recent = list.slice(-8).map((e) => `${e.date}: ${e.pages || "bet ko'rsatilmagan"}`).join("; ");
      return `- "${material}" — eng oxirgi bet: ${maxPage ?? "noma'lum"}. Oxirgi yozuvlar: ${recent}`;
    })
    .join("\n");
}

async function getOrCreatePlanId(groupId: string, weekStart: string): Promise<string> {
  const { data: existing, error } = await supabaseAi
    .from("weekly_plans")
    .select("id")
    .eq("group_id", groupId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing.id as string;

  const { data: created, error: insErr } = await supabaseAi
    .from("weekly_plans")
    .insert({ group_id: groupId, week_start: weekStart })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return created.id as string;
}

// AI qaytargan elementlarni saqlaydi. Rejasi allaqachon bor sanaga faqat
// replace=true bo'lsagina yoziladi — shu tariqa oldingi rejalar qayta yozilmaydi.
export async function savePlannedItems(
  groupId: string,
  items: PlannedItem[],
  existing: HistoryEntry[]
): Promise<SaveResult> {
  const taken = new Set(existing.map((e) => e.date));
  const result: SaveResult = { saved: [], skipped: [] };
  const byWeek = new Map<string, { date: string; day: string; item: PlannedItem }[]>();

  for (const item of items) {
    if (!isIsoDate(item.date) || !item.topic?.trim()) {
      result.skipped.push({ date: String(item.date), reason: "sana yoki mavzu noto'g'ri" });
      continue;
    }
    const day = dayNameOf(item.date);
    if (!day) {
      result.skipped.push({ date: item.date, reason: "yakshanba — reja qo'yilmaydi" });
      continue;
    }
    if (taken.has(item.date) && !item.replace) {
      result.skipped.push({ date: item.date, reason: "bu sanada reja allaqachon bor" });
      continue;
    }
    const week = mondayOf(item.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), { date: item.date, day, item }]);
  }

  for (const [week, entries] of byWeek) {
    const planId = await getOrCreatePlanId(groupId, week);
    const rows = entries.map(({ day, item }) => ({
      plan_id: planId,
      day_of_week: day,
      topic: item.topic.trim(),
      material: item.file_name?.trim() ?? "",
      pages: item.pages?.trim() ?? "",
      homework: item.homework?.trim() ?? "",
      source: "ai",
    }));
    const { error } = await supabaseAi.from("plan_items").upsert(rows, { onConflict: "plan_id,day_of_week" });
    if (error) throw new Error(error.message);
    for (const { date, day, item } of entries) result.saved.push({ date, day, topic: item.topic.trim() });
  }

  result.saved.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export async function loadFileAsBase64(fileId: string): Promise<{ name: string; base64: string }> {
  const { data: file, error } = await supabaseAi.from("files").select("name, storage_path").eq("id", fileId).single();
  if (error || !file) throw new Error("Fayl topilmadi (bazadan o'chirilgan bo'lishi mumkin).");

  const { data: pub } = supabaseAi.storage.from("ai-files").getPublicUrl(file.storage_path);
  const res = await fetch(pub.publicUrl);
  if (!res.ok) throw new Error(`Faylni Storage'dan olishda xato: ${file.name}`);

  return { name: file.name, base64: Buffer.from(await res.arrayBuffer()).toString("base64") };
}
