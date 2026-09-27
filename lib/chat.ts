import { supabaseAi } from "./supabase-ai";

export type ChatMessage = { role: "user" | "ai"; content: string; created_at?: string };

export async function getOrCreateSession(teacherId: string, groupId: string): Promise<string> {
  const { data: existing, error } = await supabaseAi
    .from("chat_sessions")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing.id as string;

  const { data: created, error: cErr } = await supabaseAi
    .from("chat_sessions")
    .insert({ teacher_id: teacherId, group_id: groupId })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);
  return created.id as string;
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAi
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export async function addMessage(sessionId: string, role: "user" | "ai", content: string): Promise<void> {
  const { error } = await supabaseAi.from("chat_messages").insert({ session_id: sessionId, role, content });
  if (error) throw new Error(error.message);
}
