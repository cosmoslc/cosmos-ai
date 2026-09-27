"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Loader2, Check, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ImageThumbs from "@/components/ImageThumbs";
import StudentProfile, { type ProfileTarget } from "@/components/StudentProfile";
import AudioListEditor, { fmtDuration } from "@/components/AudioListEditor";
import { useCurrentUser } from "@/lib/current-user";
import { fetchGroupsForTeacher, type GroupRow } from "@/lib/groups";
import { supabase } from "@/lib/supabase";
import { setCache, swr } from "@/lib/cache";
import { DAYS, lessonDaysOf } from "@/lib/constants";
import {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  fetchAssignmentsForGroup,
  fetchSessionsForAssignment,
  isAssignmentDone,
  sessionImages,
  markSessionChecked,
  totalAudioSeconds,
  type Assignment,
  type AudioFile,
  type HomeworkKind,
  type SessionRow,
} from "@/lib/homework";

type Student = { id: string; name: string };
type HwData = { students: Student[]; assignments: Assignment[]; sessions: Record<string, SessionRow[]> };

const KIND_LABEL: Record<HomeworkKind, string> = {
  reading: "O'qish",
  listening: "Tinglash",
  writing: "Yozish",
  speaking: "Gapirish",
};

function mondayOf(offsetWeeks: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  return d;
}

// Vazifa qaysi kunga tegishli: muddat (due_at) bo'lsa shu, bo'lmasa yaratilgan sana.
function assignmentDate(a: Assignment): Date {
  return new Date(a.due_at ?? a.created_at);
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Tinglash: vaqt audio fayllar uzunligidan avtomatik olinadi; boshqa turlarda — kiritilgan daqiqa.
function durationOf(kind: HomeworkKind, audio: AudioFile[], minutes: string): number {
  if (kind === "listening" && audio.length > 0) return totalAudioSeconds(audio);
  return Math.max(30, Math.round((Number(minutes) || 1) * 60));
}

function uploadCountOf(count: string): number {
  return Math.max(1, Math.min(20, Number(count) || 1));
}

function uploadWindowOf(minutes: string): number {
  return Math.max(60, Math.round((Number(minutes) || 10) * 60));
}

export default function HomeworkPage() {
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const { teacher, loading: teacherLoading } = useCurrentUser();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hwLoadedFor, setHwLoadedFor] = useState<string | null>(null);
  const [sessionsByAssignment, setSessionsByAssignment] = useState<Record<string, SessionRow[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  type Row = { key: number; title: string; kind: HomeworkKind; minutes: string; audioFiles: AudioFile[]; requiresUpload: boolean; uploadMinutes: string; uploadCount: string };
  const newRow = (key: number): Row => ({ key, title: "", kind: "reading", minutes: "15", audioFiles: [], requiresUpload: false, uploadMinutes: "10", uploadCount: "1" });
  const [rows, setRows] = useState<Row[]>([newRow(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [dayName, setDayName] = useState<string>("");

  useEffect(() => {
    if (!teacher) return;
    let active = true;
    swr(`groups:${teacher.id}`, () => fetchGroupsForTeacher(teacher.id), (rows) => {
      setGroups(rows);
      setGroupId((prev) => prev ?? rows[0]?.id ?? null);
    }, () => active).catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [teacher]);

  useEffect(() => {
    if (!groupId) return;
    let active = true;
    setHwLoadedFor(null);
    swr<HwData>(`hw:${groupId}`, async () => {
      const { data, error: sErr } = await supabase
        .from("students")
        .select("id, name")
        .contains("group_ids", JSON.stringify([groupId]));
      if (sErr) throw new Error(sErr.message);
      const rows = await fetchAssignmentsForGroup(groupId);
      const entries = await Promise.all(rows.map(async (a) => [a.id, await fetchSessionsForAssignment(a.id)] as const));
      return { students: (data as Student[]) ?? [], assignments: rows, sessions: Object.fromEntries(entries) };
    }, (d) => {
      setStudents(d.students);
      setAssignments(d.assignments);
      setSessionsByAssignment(d.sessions);
      setHwLoadedFor(groupId);
    }, () => active).catch((err) => active && setError(err instanceof Error ? err.message : "Yuklashda xato."));
    return () => {
      active = false;
    };
  }, [groupId]);

  // Sahifadagi o'zgarishlar (yaratish, tahrirlash, tekshirish) keshga ham yoziladi.
  useEffect(() => {
    if (groupId && hwLoadedFor === groupId) {
      setCache<HwData>(`hw:${groupId}`, { students, assignments, sessions: sessionsByAssignment });
    }
  }, [groupId, hwLoadedFor, students, assignments, sessionsByAssignment]);

  const weekStart = useMemo(() => mondayOf(weekOffset), [weekOffset]);
  const dayDates = useMemo(
    () => DAYS.map((_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart]
  );

  const group = groups.find((g) => g.id === groupId) ?? null;
  const lessonDays = useMemo(() => lessonDaysOf(group?.days), [group]);

  useEffect(() => {
    setDayName((prev) => {
      if (lessonDays.some((d) => d === prev)) return prev;
      const today = DAYS[Math.min((new Date().getDay() + 6) % 7, DAYS.length - 1)];
      return lessonDays.find((d) => d === today) ?? lessonDays[0];
    });
  }, [lessonDays]);

  const dateOf = (day: string) => dayDates[DAYS.findIndex((d) => d === day)];

  const byDay = useMemo(() => {
    const cols: Assignment[][] = DAYS.map(() => []);
    for (const a of assignments) {
      const d = assignmentDate(a);
      const idx = dayDates.findIndex(
        (x) => x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate()
      );
      if (idx >= 0) cols[idx].push(a);
    }
    return cols;
  }, [assignments, dayDates]);

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => {
    setRows((rs) => [...rs, newRow(nextKey)]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  async function onCreateAssignment() {
    const filled = rows.filter((r) => r.title.trim());
    if (!groupId || filled.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const due = new Date(dateOf(dayName));
      due.setHours(23, 59, 0, 0);
      const created: Assignment[] = [];
      for (const r of filled) {
        created.push(
          await createAssignment({
            groupId,
            teacherId: teacher?.id ?? null,
            title: r.title.trim(),
            kind: r.kind,
            instructions: "",
            audioFiles: r.kind === "listening" ? r.audioFiles : [],
            durationSeconds: durationOf(r.kind, r.audioFiles, r.minutes),
            dueAt: due.toISOString(),
            requiresUpload: r.requiresUpload,
            uploadWindowSeconds: uploadWindowOf(r.uploadMinutes),
            requiredUploads: uploadCountOf(r.uploadCount),
          })
        );
      }
      setAssignments((prev) => [...created.reverse(), ...prev]);
      setRows([newRow(nextKey)]);
      setNextKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vazifa yaratishda xato.");
    } finally {
      setBusy(false);
    }
  }

  type Edit = { id: string; title: string; kind: HomeworkKind; minutes: string; day: string; requiresUpload: boolean; contentUrl: string; audioFiles: AudioFile[]; uploadMinutes: string; uploadCount: string };
  const [edit, setEdit] = useState<Edit | null>(null);

  function startEdit(a: Assignment, day: string) {
    setEdit({
      id: a.id,
      title: a.title,
      kind: a.kind,
      minutes: String(Math.round(a.duration_seconds / 60)),
      day,
      requiresUpload: a.requires_upload,
      contentUrl: a.content_url ?? "",
      audioFiles: a.audio_files ?? [],
      uploadMinutes: String(Math.round((a.upload_window_seconds ?? 600) / 60)),
      uploadCount: String(a.required_uploads ?? 1),
    });
  }

  async function onSaveEdit() {
    if (!edit || !edit.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const due = new Date(dateOf(edit.day));
      due.setHours(23, 59, 0, 0);
      const updated = await updateAssignment(edit.id, {
        title: edit.title.trim(),
        kind: edit.kind,
        durationSeconds: durationOf(edit.kind, edit.audioFiles, edit.minutes),
        dueAt: due.toISOString(),
        requiresUpload: edit.requiresUpload,
        contentUrl: edit.kind === "listening" ? edit.contentUrl || null : null,
        audioFiles: edit.kind === "listening" ? edit.audioFiles : [],
        uploadWindowSeconds: uploadWindowOf(edit.uploadMinutes),
        requiredUploads: uploadCountOf(edit.uploadCount),
      });
      setAssignments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xato.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAssignment(id: string) {
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirishda xato.");
    }
  }

  async function onToggleChecked(session: SessionRow) {
    try {
      await markSessionChecked(session.id, !session.checked);
      setSessionsByAssignment((prev) => ({
        ...prev,
        [session.assignment_id]: (prev[session.assignment_id] ?? []).map((s) =>
          s.id === session.id ? { ...s, checked: !s.checked } : s
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belgilashda xato.");
    }
  }

  function studentName(id: string): string {
    return students.find((s) => s.id === id)?.name ?? id;
  }

  const weekLabel = `${fmt(dayDates[0])} – ${fmt(dayDates[DAYS.length - 1])}`;

  return (
    <div>
      <PageHeader
        title="Vazifalar"
        hint="Guruhni tanlang, vazifa qo'shing va hafta kunlari bo'yicha ko'ring. O'quvchi mobil ilovada Start bosgach vaqt hisoblanadi."
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {teacherLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <select
            aria-label="Guruhni tanlang"
            value={groupId ?? ""}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-w-[200px] font-medium"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {group && (
        <>
          {/* Yangi vazifa */}
          <section className="mb-5 rounded-lg border border-line bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" aria-hidden />Yangi vazifa</h2>
              <select aria-label="Dars kuni" value={dayName} onChange={(e) => setDayName(e.target.value)}>
                {lessonDays.map((d) => (
                  <option key={d} value={d}>{d} ({fmt(dateOf(d))})</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={r.key} className="rounded-md border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="min-w-[200px] flex-1"
                      placeholder={`Sarlavha (masalan, Unit ${idx + 5} - Reading)`}
                      value={r.title}
                      onChange={(e) => updateRow(r.key, { title: e.target.value })}
                    />
                    <select aria-label="Turi" value={r.kind} onChange={(e) => updateRow(r.key, { kind: e.target.value as HomeworkKind })}>
                      {(Object.keys(KIND_LABEL) as HomeworkKind[]).map((k) => (
                        <option key={k} value={k}>{KIND_LABEL[k]}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Fayl yuklash"
                      value={r.requiresUpload ? "yes" : "no"}
                      onChange={(e) => updateRow(r.key, { requiresUpload: e.target.value === "yes" })}
                    >
                      <option value="no">Fayl yuklash shart emas</option>
                      <option value="yes">O'quvchi fayl yuklashi kerak</option>
                    </select>
                    {r.kind === "listening" && r.audioFiles.length > 0 ? (
                      <span className="text-sm text-ink-soft" title="Audio uzunligidan avtomatik">{fmtDuration(totalAudioSeconds(r.audioFiles))} (avto)</span>
                    ) : (
                      <>
                        <input
                          aria-label="Vaqt (daqiqa)"
                          type="text"
                          inputMode="numeric"
                          className="w-20"
                          value={r.minutes}
                          onChange={(e) => updateRow(r.key, { minutes: e.target.value.replace(/\D/g, "") })}
                        />
                        <span className="text-sm text-ink-soft">daq.</span>
                      </>
                    )}
                    <button
                      onClick={() => removeRow(r.key)}
                      disabled={rows.length === 1}
                      className="text-ink-soft hover:text-danger disabled:opacity-30"
                      aria-label="Qatorni olib tashlash"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {r.kind === "listening" && (
                    <AudioListEditor files={r.audioFiles} onChange={(audioFiles) => updateRow(r.key, { audioFiles })} />
                  )}
                  {r.requiresUpload && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                      Vaqt tugagach fayl yuklash uchun
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-16"
                        aria-label="Fayl yuklash vaqti (daqiqa)"
                        value={r.uploadMinutes ?? "10"}
                        onChange={(e) => updateRow(r.key, { uploadMinutes: e.target.value.replace(/\D/g, "") })}
                      />
                      daqiqa beriladi ·
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-14"
                        aria-label="Eng ko'pi bilan nechta rasm yuklash mumkin"
                        value={r.uploadCount ?? "1"}
                        onChange={(e) => updateRow(r.key, { uploadCount: e.target.value.replace(/\D/g, "") })}
                      />
                      tagacha rasm mumkin
                    </label>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={addRow} className="btn-ghost"><Plus className="h-4 w-4" aria-hidden />Vazifa qo'shish</button>
              <button disabled={busy || !rows.some((r) => r.title.trim())} onClick={onCreateAssignment} className="btn-primary">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yuborish
              </button>
            </div>
          </section>

          {/* Hafta navigatsiyasi */}
          <div className="mb-3 flex items-center gap-2">
            <button className="btn-ghost !px-2" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Oldingi hafta">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[120px] text-center text-sm font-medium">{weekLabel}</span>
            <button className="btn-ghost !px-2" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Keyingi hafta">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            {weekOffset !== 0 && (
              <button className="btn-ghost" onClick={() => setWeekOffset(0)}>Shu hafta</button>
            )}
          </div>

          {/* Hafta kunlari: har kun alohida box */}
          <div className="overflow-x-auto pb-2">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${lessonDays.length}, minmax(200px, 1fr))` }}>
              {lessonDays.map((day) => {
                const i = DAYS.findIndex((d) => d === day);
                const isToday = dayDates[i].toDateString() === new Date().toDateString();
                return (
                  <section
                    key={day}
                    className={`flex min-h-[220px] flex-col gap-3 rounded-lg border bg-card p-3 ${
                      isToday ? "border-brand ring-2 ring-brand/15" : "border-line"
                    }`}
                  >
                    <Link
                      href={`/homework/${groupId}/${isoLocal(dayDates[i])}`}
                      className="-m-1 flex items-baseline justify-between rounded-md border-b border-line p-1 pb-2 hover:bg-brand-tint"
                      title="Shu kun bo'yicha batafsil"
                    >
                      <span className="text-sm font-semibold">{day}</span>
                      <span className="text-xs text-ink-soft">{fmt(dayDates[i])} ›</span>
                    </Link>

                    {byDay[i].map((a) => {
                      const sessions = sessionsByAssignment[a.id] ?? [];
                      const done = sessions.filter((s) => isAssignmentDone(a, s)).length;
                      const submitted = sessions.filter((s) => sessionImages(s).length > 0);
                      if (edit?.id === a.id) {
                        return (
                          <article key={a.id} className="space-y-2 rounded-md border border-brand bg-paper p-2.5">
                            <input
                              className="w-full"
                              aria-label="Sarlavha"
                              value={edit.title}
                              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                            />
                            <select className="w-full" aria-label="Turi" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as HomeworkKind })}>
                              {(Object.keys(KIND_LABEL) as HomeworkKind[]).map((k) => (
                                <option key={k} value={k}>{KIND_LABEL[k]}</option>
                              ))}
                            </select>
                            {edit.kind === "listening" && (
                              <AudioListEditor files={edit.audioFiles} onChange={(audioFiles) => setEdit((cur) => (cur ? { ...cur, audioFiles } : cur))} />
                            )}
                            <select className="w-full" aria-label="Dars kuni" value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>
                              {lessonDays.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                            <select
                              className="w-full"
                              aria-label="Fayl yuklash"
                              value={edit.requiresUpload ? "yes" : "no"}
                              onChange={(e) => setEdit({ ...edit, requiresUpload: e.target.value === "yes" })}
                            >
                              <option value="no">Fayl yuklash shart emas</option>
                              <option value="yes">O'quvchi fayl yuklashi kerak</option>
                            </select>
                            {edit.kind === "listening" && edit.audioFiles.length > 0 ? (
                              <p className="text-sm text-ink-soft">Vaqt: {fmtDuration(totalAudioSeconds(edit.audioFiles))} (audio uzunligidan avtomatik)</p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  aria-label="Vaqt (daqiqa)"
                                  type="text"
                                  inputMode="numeric"
                                  className="w-20"
                                  value={edit.minutes}
                                  onChange={(e) => setEdit({ ...edit, minutes: e.target.value.replace(/\D/g, "") })}
                                />
                                <span className="text-sm text-ink-soft">daq.</span>
                              </div>
                            )}
                            {edit.requiresUpload && (
                              <label className="flex items-center gap-2 text-sm text-ink-soft">
                                Fayl yuklash vaqti
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-16"
                                  aria-label="Fayl yuklash vaqti (daqiqa)"
                                  value={edit.uploadMinutes ?? "10"}
                                  onChange={(e) => setEdit({ ...edit, uploadMinutes: e.target.value.replace(/\D/g, "") })}
                                />
                                daq.
                              </label>
                            )}
                            {edit.requiresUpload && (
                              <label className="flex items-center gap-2 text-sm text-ink-soft">
                                Eng ko'pi bilan nechta rasm mumkin
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-16"
                                  aria-label="Eng ko'pi bilan nechta rasm yuklash mumkin"
                                  value={edit.uploadCount ?? "1"}
                                  onChange={(e) => setEdit({ ...edit, uploadCount: e.target.value.replace(/\D/g, "") })}
                                />
                              </label>
                            )}
                            <div className="flex gap-2">
                              <button onClick={onSaveEdit} disabled={busy || !edit.title.trim()} className="btn-primary !px-2.5 !py-1.5">
                                <Check className="h-4 w-4" aria-hidden />Saqlash
                              </button>
                              <button onClick={() => setEdit(null)} className="btn-ghost !px-2.5 !py-1.5">
                                <X className="h-4 w-4" aria-hidden />Bekor
                              </button>
                            </div>
                          </article>
                        );
                      }
                      return (
                        <article key={a.id} className="rounded-md border border-line bg-paper p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">
                              {a.title}
                              {a.requires_upload && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-ink-soft" aria-label="Fayl talab qilinadi" />}
                            </p>
                            <button
                              onClick={() => startEdit(a, day)}
                              className="ml-auto shrink-0 text-ink-soft hover:text-brand"
                              aria-label="Vazifani tahrirlash"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              onClick={() => onDeleteAssignment(a.id)}
                              className="shrink-0 text-ink-soft hover:text-danger"
                              aria-label="Vazifani o'chirish"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
                            {KIND_LABEL[a.kind]} · {a.kind === "listening" && a.audio_files?.length ? `${fmtDuration(a.duration_seconds)} · ${a.audio_files.length} ta audio` : `${Math.round(a.duration_seconds / 60)} daq.`}
                          </p>
                          <p className="text-xs text-ink-soft">
                            {done}/{students.length} bajardi
                            {a.requires_upload && ` · ${submitted.length} ta o'quvchi rasm yukladi (${students.length - submitted.length} ta hali yo'q)`}
                          </p>

                          {a.requires_upload && submitted.length > 0 && (
                            <div className="mt-2 space-y-1 border-t border-line pt-2">
                              {submitted.map((s) => (
                                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                                  <button
                                    className="min-w-0 flex-1 truncate text-left hover:text-brand hover:underline"
                                    onClick={() => setProfile({ id: s.student_id, name: studentName(s.student_id), groupId: a.group_id })}
                                  >
                                    {studentName(s.student_id)}
                                  </button>
                                  <ImageThumbs urls={sessionImages(s)} size={32} />
                                  <span className="text-ink-soft">{sessionImages(s).length}/{a.required_uploads ?? 1} ta yuklandi</span>
                                  <button
                                    onClick={() => onToggleChecked(s)}
                                    className={s.checked ? "text-brand" : "text-ink-faint"}
                                    aria-label={s.checked ? "Tekshirildi" : "Tekshirilmadi"}
                                    title={s.checked ? "Tekshirildi" : "Tekshirilmadi"}
                                  >
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {byDay[i].length === 0 && <p className="text-xs text-ink-faint">Vazifa yo'q</p>}
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}
      {profile && <StudentProfile target={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
