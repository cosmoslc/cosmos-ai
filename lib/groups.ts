import { supabase } from "./supabase";

export type GroupRow = {
  id: string;
  name: string;
  days: string[] | null;
  time: string | null;
  ai_bot_enabled: boolean;
  studentCount: number;
};

export async function fetchGroupsForTeacher(teacherId: string): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, days, time, ai_bot_enabled")
    .eq("teacher_hr_id", teacherId)
    .order("name");
  if (error) throw new Error(error.message);

  const groups = data ?? [];
  const counts = await Promise.all(
    groups.map(async (g) => {
      const { count, error: cErr } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .contains("group_ids", JSON.stringify([g.id]));
      if (cErr) return 0;
      return count ?? 0;
    })
  );

  return groups.map((g, i) => ({ ...g, studentCount: counts[i] ?? 0 }));
}

export async function setGroupBotEnabled(groupId: string, enabled: boolean) {
  const { error } = await supabase.from("groups").update({ ai_bot_enabled: enabled }).eq("id", groupId);
  if (error) throw new Error(error.message);
}
