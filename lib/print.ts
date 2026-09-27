import { supabaseAi } from "./supabase-ai";

export type PrintStatus = "queued" | "printing" | "done" | "failed";
export type PrintJob = {
  id: string;
  file_name: string;
  pages: string;
  status: PrintStatus;
  created_at: string;
};

export async function fetchJobs(): Promise<PrintJob[]> {
  const { data, error } = await supabaseAi
    .from("print_jobs")
    .select("id, file_name, pages, status, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function submitPrintJob(opts: {
  teacherId: string | null;
  fileId: string | null;
  fileName: string;
  pages: string;
}): Promise<{ job: PrintJob; ahead: number }> {
  const { count } = await supabaseAi
    .from("print_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["printing", "queued"]);
  const ahead = count ?? 0;
  const status: PrintStatus = ahead > 0 ? "queued" : "printing";

  const { data, error } = await supabaseAi
    .from("print_jobs")
    .insert({ teacher_id: opts.teacherId, file_id: opts.fileId, file_name: opts.fileName, pages: opts.pages, status })
    .select("id, file_name, pages, status, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { job: data as PrintJob, ahead };
}

// Print navbati o'zgarganda darhol UI'ni yangilash uchun (Supabase Realtime).
// supabase/ai_project.sql da `alter publication supabase_realtime add table print_jobs;`
// ishga tushirilgan bo'lishi kerak, aks holda bu hech narsa qaytarmaydi va
// sahifa shunchaki qo'lda yangilanadi (buzilmaydi, faqat real-time ishlamaydi).
export function subscribeToJobs(onChange: () => void) {
  const channel = supabaseAi
    .channel("print_jobs_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "print_jobs" }, onChange)
    .subscribe();
  return () => {
    supabaseAi.removeChannel(channel);
  };
}
