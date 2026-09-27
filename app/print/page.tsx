"use client";
import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { fetchCategories, fetchFiles, type FileCategory, type FileRow } from "@/lib/files";
import { fetchJobs, submitPrintJob, subscribeToJobs, type PrintJob } from "@/lib/print";

const statusLabel: Record<PrintJob["status"], string> = {
  printing: "Chop etilmoqda",
  queued: "Navbatda",
  done: "Tayyor",
  failed: "Xato",
};

export default function PrintPage() {
  const { teacher } = useCurrentUser();
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileId, setFileId] = useState("");
  const [pages, setPages] = useState("");
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [pending, setPending] = useState<{ fileName: string; pages: string; fileId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reloadJobs = () => fetchJobs().then(setJobs).catch((err) => setError(err.message));

  useEffect(() => {
    reloadJobs();
    const unsubscribe = subscribeToJobs(reloadJobs);
    return unsubscribe;
  }, []);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        setCategoryId((prev) => prev || cats[0]?.id || "");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    fetchFiles(categoryId)
      .then((rows) => {
        setFiles(rows);
        setFileId(rows[0]?.id ?? "");
      })
      .catch((err) => setError(err.message));
  }, [categoryId]);

  const activeCount = jobs.filter((j) => j.status === "printing" || j.status === "queued").length;

  const doSubmit = async (fileName: string, filePages: string, fId: string) => {
    setSubmitting(true);
    setError("");
    try {
      await submitPrintJob({ teacherId: teacher?.id ?? null, fileId: fId || null, fileName, pages: filePages });
      await reloadJobs();
      setPages("");
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuborishda xato.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (!pages.trim() || !fileId) return;
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    if (activeCount > 0) {
      setPending({ fileName: file.name, pages, fileId: file.id });
    } else {
      doSubmit(file.name, pages, file.id);
    }
  };

  return (
    <>
      <PageHeader title="Print" hint="Kerakli betlarni tanlab printerga yuboring. Printer band bo'lsa, navbat holati ko'rsatiladi." />
      {error && <p role="alert" className="mb-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <section className="space-y-3 rounded-lg border border-line bg-card p-4">
          <h2 className="font-semibold">Yangi chop etish</h2>
          <label className="block text-sm">
            Bo'lim
            <select className="mt-1 w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Fayl
            {files.length === 0 ? (
              <p className="mt-1 text-xs text-ink-soft">Bu bo'limda fayl yo'q</p>
            ) : (
              <select className="mt-1 w-full" value={fileId} onChange={(e) => setFileId(e.target.value)}>
                {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </label>
          <label className="block text-sm">
            Betlar
            <input className="mt-1 w-full" value={pages} placeholder="Masalan, 24-27" onChange={(e) => setPages(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={!pages.trim() || !fileId || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
            Printerga yuborish
          </button>
        </section>

        <section className="space-y-3">
          {pending && (
            <div role="alert" className="rounded-lg border border-amber bg-amber-tint p-4">
              <p className="text-sm font-medium">Printer band. Sizning oldingizda {activeCount} ta ish bor.</p>
              <p className="mt-1 text-sm text-ink-soft">Navbatga qo'shib, kutasizmi?</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => doSubmit(pending.fileName, pending.pages, pending.fileId)}>Kutaman</button>
                <button className="btn-ghost" onClick={() => setPending(null)}>Bekor qilish</button>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-line bg-card">
            <h2 className="border-b border-line p-4 font-semibold">Navbat</h2>
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">Navbat bo'sh.</p>
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span>{j.file_name} <span className="text-ink-soft">· {j.pages}-betlar</span></span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        j.status === "printing" ? "bg-brand-tint text-brand" : j.status === "failed" ? "bg-danger-tint text-danger" : "bg-paper text-ink-soft"
                      }`}
                    >
                      {statusLabel[j.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
