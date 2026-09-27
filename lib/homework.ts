import { supabaseAi } from "./supabase-ai";

export type HomeworkKind = "reading" | "listening" | "writing" | "speaking";

// Tinglash vazifasidagi bitta audio (ijro tartibida ketma-ket).
export type AudioFile = { url: string; name: string; duration_seconds: number };

export type Assignment = {
  id: string;
  group_id: string;
  teacher_id: string | null;
  title: string;
  kind: HomeworkKind;
  instructions: string;
  content_url: string | null;
  duration_seconds: number;
  due_at: string | null;
  created_at: string;
  requires_upload: boolean;
  audio_files: AudioFile[];
  upload_window_seconds: number;
  required_uploads: number;
};

export type SessionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: "not_started" | "in_progress" | "paused" | "completed" | "expired";
  started_at: string | null;
  deadline_at: string | null;
  accumulated_seconds: number;
  completed_at: string | null;
  submission_url: string | null;
  submission_urls: string[] | null;
  submission_uploaded_at: string | null;
  checked: boolean;
  checked_at: string | null;
  teacher_note: string | null;
  upload_opens_at: string | null;
  upload_deadline_at: string | null;
};

/** O'quvchi yuklagan rasmlar (eski bitta-fayl yozuvlari ham hisobga olinadi). */
export function sessionImages(s?: SessionRow): string[] {
  if (!s) return [];
  if (s.submission_urls && s.submission_urls.length > 0) return s.submission_urls;
  return s.submission_url ? [s.submission_url] : [];
}

/** Bajardi: fayl talab qilinsa — muddat ichida kerakli sondagi rasm yuklangan (server tekshiradi); aks holda vazifa yakunlangan. */
export function isAssignmentDone(a: Assignment, s?: SessionRow): boolean {
  if (!s) return false;
  return a.requires_upload ? sessionImages(s).length >= (a.required_uploads ?? 1) : s.status === "completed";
}

export async function fetchAssignmentsForGroup(groupId: string): Promise<Assignment[]> {
  const { data, error } = await supabaseAi
    .from("homework_assignments")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAssignment(input: {
  groupId: string;
  teacherId: string | null;
  title: string;
  kind: HomeworkKind;
  instructions: string;
  contentUrl?: string | null;
  durationSeconds: number;
  dueAt?: string | null;
  requiresUpload?: boolean;
  audioFiles?: AudioFile[];
  uploadWindowSeconds?: number;
  requiredUploads?: number;
}): Promise<Assignment> {
  const { data, error } = await supabaseAi
    .from("homework_assignments")
    .insert({
      group_id: input.groupId,
      teacher_id: input.teacherId,
      title: input.title,
      kind: input.kind,
      instructions: input.instructions,
      content_url: input.contentUrl ?? null,
      duration_seconds: input.durationSeconds,
      due_at: input.dueAt ?? null,
      requires_upload: input.requiresUpload ?? false,
      audio_files: input.audioFiles ?? [],
      upload_window_seconds: input.uploadWindowSeconds ?? 600,
      required_uploads: input.requiredUploads ?? 1,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Assignment;
}

export async function updateAssignment(
  id: string,
  patch: {
    title: string;
    kind: HomeworkKind;
    durationSeconds: number;
    dueAt: string | null;
    requiresUpload: boolean;
    contentUrl: string | null;
    audioFiles: AudioFile[];
    uploadWindowSeconds: number;
    requiredUploads: number;
  }
): Promise<Assignment> {
  const { data, error } = await supabaseAi
    .from("homework_assignments")
    .update({
      title: patch.title,
      kind: patch.kind,
      duration_seconds: patch.durationSeconds,
      due_at: patch.dueAt,
      requires_upload: patch.requiresUpload,
      content_url: patch.contentUrl,
      audio_files: patch.audioFiles,
      upload_window_seconds: patch.uploadWindowSeconds,
      required_uploads: patch.requiredUploads,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Assignment;
}

/** Audio faylning davomiyligini (soniya) brauzerda o'qiydi. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      fn();
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(() =>
      Number.isFinite(audio.duration) ? resolve(Math.ceil(audio.duration)) : reject(new Error(`Davomiylikni aniqlab bo'lmadi: ${file.name}`))
    );
    audio.onerror = () => done(() => reject(new Error(`Audio o'qib bo'lmadi: ${file.name}`)));
    audio.src = url;
  });
}

/** Bitta audio faylni Storage'ga yuklaydi va davomiyligini qaytaradi. */
export async function uploadHomeworkAudio(file: File): Promise<AudioFile> {
  const duration = await readAudioDuration(file);
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `homework-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabaseAi.storage.from("ai-files").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabaseAi.storage.from("ai-files").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, duration_seconds: duration };
}

export function totalAudioSeconds(files: AudioFile[]): number {
  return files.reduce((sum, f) => sum + f.duration_seconds, 0);
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabaseAi.from("homework_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchSessionsForAssignment(assignmentId: string): Promise<SessionRow[]> {
  const { data, error } = await supabaseAi
    .from("homework_sessions")
    .select("*")
    .eq("assignment_id", assignmentId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSessionsForStudent(studentId: string): Promise<SessionRow[]> {
  const { data, error } = await supabaseAi.from("homework_sessions").select("*").eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSessionsForAssignments(assignmentIds: string[]): Promise<SessionRow[]> {
  if (assignmentIds.length === 0) return [];
  const { data, error } = await supabaseAi.from("homework_sessions").select("*").in("assignment_id", assignmentIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** O'qituvchi o'quvchi yuklagan faylni ko'rib chiqib, "tekshirildi" belgisi qo'yadi. */
export async function markSessionChecked(sessionId: string, checked: boolean, note?: string): Promise<void> {
  const { error } = await supabaseAi
    .from("homework_sessions")
    .update({
      checked,
      checked_at: checked ? new Date().toISOString() : null,
      ...(note !== undefined ? { teacher_note: note } : {}),
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

/** O'quvchilar ro'yxatini (login uchun) yaratish/yangilash — telefon + parol. */
export async function upsertStudentAuth(input: {
  studentId: string;
  phone: string;
  password: string; // oddiy matn — shu yerda hash qilinadi
  fullName: string;
}): Promise<void> {
  const passwordHash = await sha256Hex(input.password);
  const { error } = await supabaseAi
    .from("students_auth")
    .upsert(
      {
        student_id: input.studentId,
        phone: normalizePhone(input.phone),
        password_hash: passwordHash,
        full_name: input.fullName,
      },
      { onConflict: "student_id" }
    );
  if (error) throw new Error(error.message);
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
