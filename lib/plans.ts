import { supabaseAi } from "./supabase-ai";
import { DAYS, emptyPlanItem, type PlanItem } from "./constants";
import { mondayOf, todayIso } from "./dates";

export type PlansByDay = Record<string, PlanItem>;

export function currentWeekStart(): string {
  return mondayOf(todayIso());
}

async function findWeeklyPlanId(groupId: string, weekStart: string): Promise<string | null> {
  const { data, error } = await supabaseAi
    .from("weekly_plans")
    .select("id")
    .eq("group_id", groupId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

async function getOrCreateWeeklyPlanId(groupId: string, weekStart: string): Promise<string> {
  const existing = await findWeeklyPlanId(groupId, weekStart);
  if (existing) return existing;

  const { data: created, error: insErr } = await supabaseAi
    .from("weekly_plans")
    .insert({ group_id: groupId, week_start: weekStart })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return created.id as string;
}

export async function fetchPlan(groupId: string, weekStart: string = currentWeekStart()): Promise<PlansByDay> {
  const plan: PlansByDay = Object.fromEntries(DAYS.map((d) => [d, emptyPlanItem()]));
  const planId = await findWeeklyPlanId(groupId, weekStart);
  if (!planId) return plan;

  const { data, error } = await supabaseAi
    .from("plan_items")
    .select("day_of_week, topic, material, pages, homework, source")
    .eq("plan_id", planId);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    plan[row.day_of_week] = {
      topic: row.topic ?? "",
      material: row.material ?? "",
      pages: row.pages ?? "",
      homework: row.homework ?? "",
      source: (row.source as PlanItem["source"]) ?? "",
    };
  }
  return plan;
}

export async function saveDayItem(
  groupId: string,
  day: string,
  item: PlanItem,
  weekStart: string = currentWeekStart()
): Promise<void> {
  const planId = await getOrCreateWeeklyPlanId(groupId, weekStart);
  const { error } = await supabaseAi
    .from("plan_items")
    .upsert({ plan_id: planId, day_of_week: day, ...item }, { onConflict: "plan_id,day_of_week" });
  if (error) throw new Error(error.message);
}

export async function clearPlan(groupId: string, weekStart: string = currentWeekStart()): Promise<void> {
  const empty = emptyPlanItem();
  await Promise.all(DAYS.map((day) => saveDayItem(groupId, day, empty, weekStart)));
}
