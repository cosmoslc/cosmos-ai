"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Settings2, Sparkles, Trash2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { fetchGroupsForTeacher, setGroupBotEnabled, type GroupRow } from "@/lib/groups";
import { fetchPlan, saveDayItem, clearPlan, currentWeekStart, type PlansByDay } from "@/lib/plans";
import { addDays, shortDate } from "@/lib/dates";
import { peek, setCache, swr } from "@/lib/cache";
import { DAYS, lessonDaysOf, type PlanItem } from "@/lib/constants";
import {
  DEFAULT_FIELDS, PLACEHOLDERS, loadExtra, loadFields, newFieldId, saveExtra, saveFields,
  type ExtraValues, type FieldDef, type FieldsByDay,
} from "@/lib/plan-fields";

export default function GroupsPage() {
  const { teacher, loading: teacherLoading } = useCurrentUser();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [plan, setPlan] = useState<PlansByDay | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => currentWeekStart());
  const [fields, setFields] = useState<FieldsByDay>({});
  const [extra, setExtra] = useState<ExtraValues>({});
  const [editingFields, setEditingFields] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    let active = true;
    const key = `groups:${teacher.id}`;
    setLoadingGroups(peek(key) === undefined);
    swr(key, () => fetchGroupsForTeacher(teacher.id), (rows) => {
      setGroups(rows);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    }, () => active)
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoadingGroups(false));
    return () => {
      active = false;
    };
  }, [teacher]);

  const group = groups.find((g) => g.id === selectedId) ?? groups[0] ?? null;
  const lessonDays = lessonDaysOf(group?.days);

  useEffect(() => {
    if (!group) return;
    let active = true;
    const key = `plan:${group.id}:${weekStart}`;
    setLoadingPlan(peek(key) === undefined);
    swr(key, () => fetchPlan(group.id, weekStart), setPlan, () => active)
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoadingPlan(false));
    return () => {
      active = false;
    };
  }, [group?.id, weekStart]);

  useEffect(() => {
    if (group) setFields(loadFields(group.id, DAYS));
  }, [group?.id]);

  useEffect(() => {
    if (group) setExtra(loadExtra(group.id, weekStart));
  }, [group?.id, weekStart]);

  const changeDayFields = (day: string, next: FieldDef[]) => {
    if (!group) return;
    const all = { ...fields, [day]: next };
    setFields(all);
    saveFields(group.id, all);
  };
  const dayFields = (day: string) => fields[day] ?? DEFAULT_FIELDS;
  const renameField = (day: string, id: string, label: string) =>
    changeDayFields(day, dayFields(day).map((f) => (f.id === id ? { ...f, label } : f)));
  const removeField = (day: string, id: string) => changeDayFields(day, dayFields(day).filter((f) => f.id !== id));
  const addField = (day: string) => changeDayFields(day, [...dayFields(day), { id: newFieldId(), label: "Yangi maydon" }]);
  const restoreFields = (day: string) => changeDayFields(day, DEFAULT_FIELDS);

  const updateExtra = (day: string, id: string, value: string) =>
    setExtra((prev) => ({ ...prev, [day]: { ...prev[day], [id]: value } }));
  const persistExtra = () => group && saveExtra(group.id, weekStart, extra);

  const updateField = (day: string, patch: Partial<PlanItem>) => {
    if (!plan) return;
    setPlan({ ...plan, [day]: { ...plan[day], ...patch } });
  };

  const persistField = async (day: string) => {
    if (!plan || !group) return;
    try {
      await saveDayItem(group.id, day, { ...plan[day], source: "manual" }, weekStart);
      setCache(`plan:${group.id}:${weekStart}`, plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlashda xato.");
    }
  };

  const onClear = async () => {
    if (!group) return;
    try {
      await clearPlan(group.id, weekStart);
      const fresh = await fetchPlan(group.id, weekStart);
      setCache(`plan:${group.id}:${weekStart}`, fresh);
      setPlan(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tozalashda xato.");
    }
  };

  const toggleBot = async (g: GroupRow) => {
    const next = !g.ai_bot_enabled;
    setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, ai_bot_enabled: next } : x)));
    try {
      await setGroupBotEnabled(g.id, next);
      if (teacher) setCache(`groups:${teacher.id}`, groups.map((x) => (x.id === g.id ? { ...x, ai_bot_enabled: next } : x)));
    } catch (err) {
      setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, ai_bot_enabled: g.ai_bot_enabled } : x)));
      setError(err instanceof Error ? err.message : "Botni yoqishda xato.");
    }
  };

  if (teacherLoading || loadingGroups) {
    return (
      <>
        <PageHeader title="Guruhlar" />
        <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <PageHeader title="Guruhlar" />
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          Bu o'qituvchiga (teacher_hr_id) hech qanday guruh biriktirilmagan.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Guruhlar" hint="Guruhni tanlang va haftalik rejani qo'lda yozing yoki Fayllar bo'limidan AI bilan tuzdiring." />
      {error && <p role="alert" className="mb-4 rounded-xl bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      <section className="min-w-0 rounded-xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Guruhni tanlang"
              value={group.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-w-[200px] font-medium"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <Link href="/files" className="btn-primary">
              <Sparkles className="h-4 w-4" aria-hidden />AI bilan reja tuzish
            </Link>
            <button className="btn-ghost" onClick={onClear}>
              <Trash2 className="h-4 w-4" aria-hidden />Rejani tozalash
            </button>
            <button className="btn-ghost" onClick={() => setEditingFields((v) => !v)} aria-pressed={editingFields}>
              <Settings2 className="h-4 w-4" aria-hidden />{editingFields ? "Sozlashni tugatish" : "Maydonlarni sozlash"}
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={group.ai_bot_enabled} onChange={() => toggleBot(group)} className="h-4 w-4 accent-brand" />
            Bot uy vazifa va fayllarni yuboradi
          </label>
        </div>
        <p className="border-b border-line px-4 py-2 text-xs text-ink-soft">
          {(group.days ?? []).join(", ") || "Kunlar belgilanmagan"}{group.time ? `, ${group.time}` : ""} · {group.studentCount} o'quvchi
        </p>

        <div className="flex items-center gap-2 px-4 pt-4">
          <button className="btn-ghost px-2!" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Oldingi hafta">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium">{shortDate(weekStart)} – {shortDate(addDays(weekStart, 5))}</span>
          <button className="btn-ghost px-2!" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Keyingi hafta">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          {weekStart !== currentWeekStart() && (
            <button className="btn-ghost" onClick={() => setWeekStart(currentWeekStart())}>Shu hafta</button>
          )}
        </div>

        {editingFields && (
          <p className="mx-4 mt-4 rounded-xl bg-amber-tint p-3 text-xs text-ink-soft">
            Har bir kun ustuni alohida sozlanadi: sarlavhani yozib o'zgartiring, ✕ bilan olib tashlang, ustun pastidagi tugma bilan input qo'shing.
          </p>
        )}

        {loadingPlan || !plan ? (
          <p className="flex items-center gap-2 p-4 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Reja yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto p-4">
            <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: `repeat(${lessonDays.length}, minmax(150px, 1fr))` }}>
              {lessonDays.map((day) => {
                const item = plan[day];
                return (
                  <div key={day} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{day} <span className="font-normal text-ink-soft">{shortDate(addDays(weekStart, DAYS.indexOf(day)))}</span></p>
                      {item.source === "ai" && <span className="rounded-md bg-amber-tint px-1.5 py-0.5 text-xs text-amber">AI</span>}
                    </div>
                    {dayFields(day).map((f) => (
                      <div key={f.id} className="block">
                        {editingFields ? (
                          <div className="mb-1 flex items-center gap-1">
                            <input
                              className="w-full py-0.5! text-xs"
                              value={f.label}
                              aria-label="Maydon sarlavhasi"
                              onChange={(e) => renameField(day, f.id, e.target.value)}
                            />
                            <button className="btn-ghost px-1!" onClick={() => removeField(day, f.id)} aria-label={`${f.label} maydonini olib tashlash`}>
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <span className="mb-1 block text-xs text-ink-soft">{f.label}</span>
                        )}
                        <input
                          className="w-full"
                          aria-label={f.label}
                          value={f.builtin ? item[f.builtin] : extra[day]?.[f.id] ?? ""}
                          placeholder={f.builtin ? PLACEHOLDERS[f.builtin] : f.label}
                          onChange={(e) => (f.builtin ? updateField(day, { [f.builtin]: e.target.value }) : updateExtra(day, f.id, e.target.value))}
                          onBlur={() => (f.builtin ? persistField(day) : persistExtra())}
                        />
                      </div>
                    ))}
                    {editingFields && (
                      <div className="flex flex-wrap gap-1">
                        <button className="btn-ghost" onClick={() => addField(day)}><Plus className="h-4 w-4" aria-hidden />Input qo'shish</button>
                        <button className="btn-ghost" onClick={() => restoreFields(day)}><RotateCcw className="h-4 w-4" aria-hidden />Standart</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
