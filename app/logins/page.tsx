"use client";
import { useEffect, useState } from "react";
import { Key, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { fetchGroupsForTeacher, type GroupRow } from "@/lib/groups";
import { supabase } from "@/lib/supabase";
import { upsertStudentAuth } from "@/lib/homework";

type Student = { id: string; name: string; phone: string | null };

export default function LoginsPage() {
  const { teacher, loading: teacherLoading } = useCurrentUser();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    fetchGroupsForTeacher(teacher.id)
      .then((rows) => {
        setGroups(rows);
        setGroupId((prev) => prev ?? rows[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, [teacher]);

  useEffect(() => {
    if (!groupId) return;
    let active = true;
    supabase
      .from("students")
      .select("id, name, phone")
      .contains("group_ids", JSON.stringify([groupId]))
      .then(({ data, error: sErr }) => {
        if (!active) return;
        if (sErr) setError(sErr.message);
        else setStudents((data as Student[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  async function onSetPassword(student: Student) {
    const password = passwords[student.id]?.trim();
    if (!password || !student.phone) return;
    setBusy(true);
    setError(null);
    try {
      await upsertStudentAuth({ studentId: student.id, phone: student.phone, password, fullName: student.name });
      setPasswords((prev) => ({ ...prev, [student.id]: "" }));
      setSaved((prev) => ({ ...prev, [student.id]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parol saqlashda xato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Loginlar"
        hint="Har bir o'quvchiga parol bering — u mobil ilovaga telefon raqami va shu parol bilan kiradi."
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      <section className="rounded-lg border border-line bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
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
          <span className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Key className="h-4 w-4" aria-hidden />{students.length} o'quvchi
          </span>
        </div>

        <div className="divide-y divide-line">
          {students.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="w-44 truncate text-sm font-medium">{s.name}</span>
              <span className="w-32 truncate text-sm text-ink-soft">{s.phone ?? "tel yo'q"}</span>
              <input
                placeholder="yangi parol"
                className="min-w-[160px] flex-1"
                value={passwords[s.id] ?? ""}
                onChange={(e) => {
                  setPasswords((prev) => ({ ...prev, [s.id]: e.target.value }));
                  setSaved((prev) => ({ ...prev, [s.id]: false }));
                }}
              />
              <button
                disabled={busy || !s.phone || !passwords[s.id]?.trim()}
                onClick={() => onSetPassword(s)}
                className="btn-primary"
              >
                Saqlash
              </button>
              {saved[s.id] && <span className="text-sm text-brand">Saqlandi</span>}
            </div>
          ))}
          {students.length === 0 && <p className="p-4 text-sm text-ink-soft">Bu guruhda o'quvchi topilmadi.</p>}
        </div>
      </section>
    </div>
  );
}
