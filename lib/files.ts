import { supabaseAi } from "./supabase-ai";

export type FileCategory = { id: string; name: string };
export type FileRow = {
  id: string;
  name: string;
  category_id: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
};

export async function fetchCategories(): Promise<FileCategory[]> {
  const { data, error } = await supabaseAi.from("file_categories").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchFiles(categoryId: string): Promise<FileRow[]> {
  const { data, error } = await supabaseAi
    .from("files")
    .select("id, name, category_id, storage_path, size_bytes, created_at")
    .eq("category_id", categoryId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAllFiles(): Promise<FileRow[]> {
  const { data, error } = await supabaseAi
    .from("files")
    .select("id, name, category_id, storage_path, size_bytes, created_at")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function uploadFile(file: File, categoryId: string, teacherId: string | null): Promise<FileRow> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${categoryId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabaseAi.storage.from("ai-files").upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw new Error(`Faylni yuklashda xato: ${upErr.message}`);

  const { data, error } = await supabaseAi
    .from("files")
    .insert({ name: file.name, category_id: categoryId, storage_path: path, size_bytes: file.size, teacher_id: teacherId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FileRow;
}

export function publicFileUrl(path: string): string {
  const { data } = supabaseAi.storage.from("ai-files").getPublicUrl(path);
  return data.publicUrl;
}
