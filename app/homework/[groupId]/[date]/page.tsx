"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Paperclip } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ImageThumbs from "@/components/ImageThumbs";
import StudentProfile, { type ProfileTarget } from "@/components/StudentProfile";
import { useCurrentUser } from "@/lib/current-user";
import { fetchGroupsForTeacher, type GroupRow } from "@/lib/groups";
import { supabase } from "@/lib/supabase";
import { DAYS, lessonDaysOf } from "@/lib/constants";
import { addDays, dayNameOf, isIsoDate, isoOfTimestamp, mondayOf, shortDate } from "@/lib/dates";
import {
  fetchAssignmentsForGroup,
  completionSeconds,
  fetchSessionsForAssignments,
  fmtMinSec,
  isAssignmentDone,
  isSuspiciouslyFast,
  sessionImages,
  markSessionChecked,
  type Assignment,
  type HomeworkKind,
  type SessionRow,
} from "@/lib/homework";

type Student = { id: string; name: string };

const KIND_LABEL: Record<HomeworkKind, string> = {
  reading: "O'qish",
  listening: "Tinglash",
  writing: "Yozish",
  speaking: "Gapirish",
};

const dateOf = (a: Assignment) => isoOfTimestamp(a.due_at ?? a.created_at);

function isDone(a: Assignment, s?: SessionRow): boolean {
  return isAssignmentDone(a, s);
}

function statusChip(a: Assignment, s?: SessionRow): { text: string; cls: string } {
  if (a.requires_upload && s && !isAssignmentDone(a, s) && s.upload_deadline_at && Date.now() > new Date(s.upload_deadline_at).getTime()) {
    return { text: "Fayl yuklamadi", cls: "bg-danger-tint text-danger" };
  }
  if (s?.status === "in_progress") return { text: "Jarayonda", cls: "bg-amber-tint text-amber" };
  if (s?.status === "expired") return { text: "Vaqt tugadi", cls: "bg-danger-tint text-danger" };
  return { text: "Boshlamagan", cls: "bg-paper text-ink-soft" };
}

function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// O'quvchi vazifani boshlagandan tugatgungacha ketgan vaqt — "Start bosib darrov
// Bajardim" bosilgan bo'lsa (belgilangan vaqtning uchdan biridan kam) qizil rangda ko'rinadi.
function TimeTaken({ a, s }: { a: Assignment; s?: SessionRow }) {
  const took = completionSeconds(s);
  if (took === null) return null;
  const suspicious = isSuspiciouslyFast(a, s);
  return (
    <span
      className={`shrink-0 text-xs ${suspicious ? "font-medium text-danger" : "text-ink-soft"}`}
      title={suspicious ? "Belgilangan vaqtning uchdan biridan kamida bajargan — gumonli" : "Boshlagandan tugatgungacha ketgan vaqt"}
    >
      {fmtMinSec(took)}
    </span>
  );
}

export default function HomeworkDayPage() {
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const { groupId, date } = useParams<{ groupId: string; date: string }>();
  const { teacher, loading: teacherLoading } = useCurrentUser();
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validDate = isIsoDate(date);
  const weekStart = validDate ? mondayOf(date) : "";

  useEffect(() => {
    if (!teacher || !validDate) return;
    let active = true;
    (async () => {
      try {
        const [groups, studentsRes, all] = await Promise.all([
          fetchGroupsForTeacher(teacher.id),
          supabase.from("students").select("id, name").contains("group_ids", JSON.stringify([groupId])),
          fetchAssignmentsForGroup(groupId),
        ]);
        if (studentsRes.error) throw new Error(studentsRes.error.message);
        if (!active) return;

        const weekDates = new Set(DAYS.map((_, i) => addDays(weekStart, i)));
        const weekAssignments = all.filter((a) => weekDates.has(dateOf(a)));
        const rows = await fetchSessionsForAssignments(weekAssignments.map((a) => a.id));
        if (!active) return;

        setGroup(groups.find((g) => g.id === groupId) ?? null);
        setStudents((studentsRes.data as Student[]) ?? []);
        setAssignments(weekAssignments);
        setSessions(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Yuklashda xato.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [teacher, groupId, validDate, weekStart]);

  const sessionOf = (assignmentId: string, studentId: string) =>
    sessions.find((s) => s.assignment_id === assignmentId && s.student_id === studentId);

  const lessonDays = useMemo(() => lessonDaysOf(group?.days), [group]);

  // Sana bo'yicha statistika: o'quvchilar soni va bajarilgan vazifalar alohida sanaladi.
  const statsFor = (iso: string) => {
    const list = assignments.filter((a) => dateOf(a) === iso);
    const total = list.length * students.length;
    let done = 0;
    let activeStudents = 0;
    for (const st of students) {
      const doneCount = list.filter((a) => isDone(a, sessionOf(a.id, st.id))).length;
      done += doneCount;
      if (doneCount > 0) activeStudents++;
    }
    return {
      count: list.length,
      total,
      done,
      activeStudents,
      idleStudents: list.length === 0 ? 0 : students.length - activeStudents,
      percent: pct(done, total),
    };
  };

  async function toggleChecked(s: SessionRow) {
    try {
      await markSessionChecked(s.id, !s.checked);
      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, checked: !x.checked } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belgilashda xato.");
    }
  }

  if (!validDate) return <p className="text-sm text-danger">Sana noto'g'ri.</p>;

  const dayName = dayNameOf(date) ?? "Yakshanba";
  const dayAssignments = assignments.filter((a) => dateOf(a) === date);
  const dayStats = statsFor(date);
  const weekTotals = lessonDays.reduce(
    (acc, d) => {
      const st = statsFor(addDays(weekStart, DAYS.indexOf(d)));
      return { total: acc.total + st.total, done: acc.done + st.done };
    },
    { total: 0, done: 0 }
  );

  return (
    <div>
      <Link href="/homework" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden />Vazifalar
      </Link>
      <PageHeader
        title={`${dayName}, ${shortDate(date)}`}
        hint={group ? `${group.name} — shu kundagi vazifalar va o'quvchilar natijasi.` : undefined}
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      {teacherLoading || loading ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
      ) : !group ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">Bu guruh sizga biriktirilmagan.</p>
      ) : (
        <>
          {/* Kun statistikasi */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Vazifalar", value: dayStats.count, sub: `${students.length} o'quvchi`, tone: "text-ink" },
              { label: "Qilgan o'quvchilar", value: dayStats.activeStudents, sub: "kamida bitta vazifani", tone: "text-brand" },
              { label: "Qilmagan o'quvchilar", value: dayStats.idleStudents, sub: "hech qaysini", tone: "text-danger" },
              { label: "Bajarilish", value: `${dayStats.percent}%`, sub: `${dayStats.done}/${dayStats.total} vazifa`, tone: "text-ink" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-line bg-card p-4">
                <p className="text-xs text-ink-soft">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
                <p className="text-xs text-ink-soft">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Haftalik holat */}
          <section className="mb-6">
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              Haftalik holat
              <span className="font-normal text-ink-soft">
                {shortDate(weekStart)} – {shortDate(addDays(weekStart, 5))} · umumiy {pct(weekTotals.done, weekTotals.total)}%
              </span>
            </h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${lessonDays.length}, minmax(130px, 1fr))` }}>
              {lessonDays.map((d) => {
                const iso = addDays(weekStart, DAYS.indexOf(d));
                const st = statsFor(iso);
                const current = iso === date;
                return (
                  <Link
                    key={d}
                    href={`/homework/${groupId}/${iso}`}
                    className={`rounded-lg border bg-card p-3 transition hover:border-brand/50 ${current ? "border-brand ring-2 ring-brand/15" : "border-line"}`}
                  >
                    <p className="text-sm font-semibold">{d} <span className="font-normal text-ink-soft">{shortDate(iso)}</span></p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${st.percent}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {st.count === 0 ? "Vazifa yo'q" : `${st.count} vazifa · ${st.percent}% bajarildi`}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Vazifa kartalari */}
          <div className="space-y-4">
            {dayAssignments.map((a) => {
              const rows = students.map((st) => ({ st, s: sessionOf(a.id, st.id) }));
              const done = rows.filter((r) => isDone(a, r.s));
              const missed = rows.filter((r) => !isDone(a, r.s));
              const percent = pct(done.length, students.length);
              return (
                <section key={a.id} className="rounded-lg border border-line bg-card">
                  <div className="border-b border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {a.title}
                        {a.requires_upload && <Paperclip className="ml-1.5 inline h-4 w-4 text-ink-soft" aria-label="Fayl talab qilinadi" />}
                      </h3>
                      <span className="text-sm text-ink-soft">{KIND_LABEL[a.kind]} · {Math.round(a.duration_seconds / 60)} daq.</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-sm font-medium">{done.length}/{students.length} · {percent}%</span>
                    </div>
                  </div>

                  <div className="grid gap-px bg-line md:grid-cols-2">
                    <div className="bg-card p-4">
                      <p className="mb-2 text-sm font-semibold text-brand">Qilganlar ({done.length})</p>
                      {done.length === 0 && <p className="text-sm text-ink-soft">Hali hech kim.</p>}
                      <ul className="space-y-2">
                        {done.map(({ st, s }) => (
                          <li key={st.id} className="flex items-center gap-2 text-sm">
                            <button className="min-w-0 flex-1 truncate text-left hover:text-brand hover:underline" onClick={() => setProfile({ id: st.id, name: st.name, groupId })}>
                              {st.name}
                            </button>
                            <TimeTaken a={a} s={s} />
                            <ImageThumbs urls={sessionImages(s)} size={40} />
                            {s && sessionImages(s).length > 0 && (
                              <button
                                onClick={() => toggleChecked(s)}
                                className={`inline-flex items-center gap-1 text-xs ${s.checked ? "text-brand" : "text-ink-faint"}`}
                                title={s.checked ? "Tekshirildi" : "Tekshirilmadi"}
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                                {s.checked ? "Tekshirildi" : "Tekshirilmadi"}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-card p-4">
                      <p className="mb-2 text-sm font-semibold text-danger">Qilmaganlar ({missed.length})</p>
                      {missed.length === 0 && <p className="text-sm text-ink-soft">Hamma bajargan.</p>}
                      <ul className="space-y-2">
                        {missed.map(({ st, s }) => {
                          const chip = statusChip(a, s);
                          return (
                            <li key={st.id} className="flex items-center gap-2 text-sm">
                              <button className="min-w-0 flex-1 truncate text-left hover:text-brand hover:underline" onClick={() => setProfile({ id: st.id, name: st.name, groupId })}>
                                {st.name}
                              </button>
                              <span className={`rounded px-1.5 py-0.5 text-xs ${chip.cls}`}>{chip.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </section>
              );
            })}
            {dayAssignments.length === 0 && (
              <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
                Bu kunga vazifa berilmagan.
              </p>
            )}
          </div>
        </>
      )}
      {profile && <StudentProfile target={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
