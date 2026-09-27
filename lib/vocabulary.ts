import { supabaseAi } from "./supabase-ai";

export type VocabWord = { word: string; translation: string; example: string };

export type VocabSet = { id: string; topic: string | null; fileName: string; createdAt: string; wordCount: number };

// Barcha ajratilgan lug'atlar (eng yangisi birinchi) — faqat sarlavha ma'lumotlari.
export async function fetchVocabularySets(): Promise<VocabSet[]> {
  const { data, error } = await supabaseAi
    .from("vocabulary_sets")
    .select("id, topic, created_at, files(name), vocabulary_words(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const file = row.files as { name?: string } | { name?: string }[] | null;
    const count = row.vocabulary_words as { count: number }[] | null;
    return {
      id: row.id as string,
      topic: row.topic as string | null,
      fileName: (Array.isArray(file) ? file[0]?.name : file?.name) ?? "",
      createdAt: row.created_at as string,
      wordCount: count?.[0]?.count ?? 0,
    };
  });
}

export async function fetchSetWords(setId: string): Promise<VocabWord[]> {
  const { data, error } = await supabaseAi
    .from("vocabulary_words")
    .select("word, translation, example")
    .eq("set_id", setId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
