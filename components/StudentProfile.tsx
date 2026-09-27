"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import ImageThumbs from "@/components/ImageThumbs";
import { swr } from "@/lib/cache";
import { addDays, isoOfTimestamp, mondayOf, todayIso } from "@/lib/dates";
import {
  completionSeconds,
  fetchAssignmentsForGroup,
  fetchSessionsForStudent,
  fmtMinSec,
  isAssignmentDone,
  isSuspiciouslyFast,
  sessionImages,
  type Assignment,
  type HomeworkKind,
  type SessionRow,
} from "@/lib/homework";

export type ProfileTarget = { id: string; name: string; groupId: string };

const KIND_LABEL: Record<HomeworkKind, string> = {
  reading: "O'qish",
  listening: "Tinglash",
  writing: "Yozish",
  speaking: "Gapirish",
};

type Period = "day" | "week" | "month";
const PERIOD_LABEL: Record<Period, string> = { day: "Oxirgi vazifa kuni", week: "Shu hafta", month: "Oxirgi 30 kun" };

type Data = { assignments: Assignment[]; sessions: SessionRow[] };

const dateOf = (a: Assignment) => isoOfTimestamp(a.due_at ?? a.created_at);

// "Kunlik" karta: bugun dars bo'lmasligi mumkin, shuning uchun eng oxirgi vazifa berilgan kun
// (bugundan oshmagan; bo'lmasa eng yaqini) olinadi.
function lastLessonDate(assignments: Assignment[], today: string): string {
  const dates = assignments.map(dateOf).sort();
  if (dates.length === 0) return today;
  const past = dates.filter((d) => d <= today);
  return past.length ? past[past.length - 1] : dates[0];
}

function rangeOf(period: Period, today: string, last: string): [string, string] {
  if (period === "day") return [last, last];
  if (period === "week") {
    const start = mondayOf(today);
    return [start, addDays(start, 6)];
  }
  return [addDays(today, -29), today];
}

type Status = "done" | "missed" | "progress" | "pending";

function statusOf(a: Assignment, s: SessionRow | undefined, today: string): Status {
  if (isAssignmentDone(a, s)) return "done";
  const uploadClosed = !!(a.requires_upload && s?.upload_deadline_at && Date.now() > new Date(s.upload_deadline_at).getTime());
  if (uploadClosed || dateOf(a) < today) return "missed";
  if (s?.status === "in_progress") return "progress";
  return "pending";
}

const STATUS_CHIP: Record<Status, { text: string; cls: string }> = {
  done: { text: "Bajarildi", cls: "bg-brand-tint text-brand" },
  missed: { text: "Bajarilmadi", cls: "bg-danger-tint text-danger" },
  progress: { text: "Jarayonda", cls: "bg-amber-tint text-amber" },
  pending: { text: "Kutilmoqda", cls: "bg-paper text-ink-soft" },
};

// O'quvchi profili: kunlik / haftalik / oylik vazifa statistikasi va topshirgan rasmlari.
export default function StudentProfile({ target, onClose }: { target: ProfileTarget; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const today = todayIso();

  useEffect(() => {
    let active = true;
    setData(null);
    swr<Data>(
      `student:${target.groupId}:${target.id}`,
      async () => {
        const assignments = await fetchAssignmentsForGroup(target.groupId);
        const sessions = await fetchSessionsForStudent(target.id);
        return { assignments, sessions };
      },
      setData,
      () => active
    ).catch((err) => active && setError(err instanceof Error ? err.message : "Yuklashda xato."));
    return () => {
      active = false;
    };
  }, [target.id, target.groupId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sessionOf = (id: string) => data?.sessions.find((s) => s.assignment_id === id);

  const lastDate = useMemo(() => lastLessonDate(data?.assignments ?? [], today), [data, today]);

  const stats = useMemo(() => {
    const out = {} as Record<Period, { total: number; done: number; missed: number; percent: number }>;
    for (const p of ["day", "week", "month"] as Period[]) {
      const [from, to] = rangeOf(p, today, lastDate);
      const list = (data?.assignments ?? []).filter((a) => dateOf(a) >= from && dateOf(a) <= to);
      const done = list.filter((a) => statusOf(a, sessionOf(a.id), today) === "done").length;
      const missed = list.filter((a) => statusOf(a, sessionOf(a.id), today) === "missed").length;
      out[p] = { total: list.length, done, missed, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, today, lastDate]);

  const [from, to] = rangeOf(period, today, lastDate);
  const list = (data?.assignments ?? [])
    .filter((a) => dateOf(a) >= from && dateOf(a) <= to)
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${target.name} profili`}>
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-line bg-card p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-lg font-semibold text-brand">
            {target.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{target.name}</h2>
            <p className="text-xs text-ink-soft">Vazifalar statistikasi</p>
          </div>
          <button className="btn-ghost !px-2" onClick={onClose} aria-label="Yopish">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {error && <p role="alert" className="m-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

        {!data && !error ? (
          <p className="flex items-center gap-2 p-4 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
        ) : (
          data && (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-3">
                {(["day", "week", "month"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-lg border bg-card p-3 text-left ${period === p ? "border-brand ring-2 ring-brand/15" : "border-line"}`}
                    aria-pressed={period === p}
                  >
                    <p className="text-xs text-ink-soft">
                      {PERIOD_LABEL[p]}{p === "day" && data.assignments.length > 0 ? ` · ${lastDate.slice(8, 10)}.${lastDate.slice(5, 7)}` : ""}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{stats[p].percent}%</p>
                    <p className="text-xs text-ink-soft">{stats[p].done}/{stats[p].total} bajardi</p>
                    <p className={`text-xs ${stats[p].missed ? "text-danger" : "text-ink-soft"}`}>{stats[p].missed} ta bajarilmagan</p>
                  </button>
                ))}
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">{PERIOD_LABEL[period]} vazifalari ({list.length})</h3>
                {list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-soft">Bu davrda vazifa berilmagan.</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((a) => {
                      const s = sessionOf(a.id);
                      const st = statusOf(a, s, today);
                      const images = sessionImages(s);
                      return (
                        <li key={a.id} className="rounded-lg border border-line bg-card p-3">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">{a.title}</p>
                              <p className="text-xs text-ink-soft">
                                {KIND_LABEL[a.kind]} · {dateOf(a).slice(8, 10)}.{dateOf(a).slice(5, 7)}
                                {completionSeconds(s) !== null && (
                                  <span className={isSuspiciouslyFast(a, s) ? "font-medium text-danger" : ""}>
                                    {" "}· {fmtMinSec(completionSeconds(s)!)}da bajardi
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${STATUS_CHIP[st].cls}`}>{STATUS_CHIP[st].text}</span>
                          </div>
                          {a.requires_upload && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {images.length > 0 ? (
                                <ImageThumbs urls={images} size={56} />
                              ) : (
                                <span className="text-xs text-ink-soft">Rasm yuklanmagan</span>
                              )}
                              <span className="text-xs text-ink-soft">{images.length}/{a.required_uploads ?? 1} ta yuklandi</span>
                              {s?.checked && (
                                <span className="inline-flex items-center gap-1 text-xs text-brand">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Tekshirilgan
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )
        )}
      </aside>
    </div>
  );
}
