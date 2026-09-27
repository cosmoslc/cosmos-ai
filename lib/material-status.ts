// Faqat serverda. Guruh uchun materiallar holati: qaysi kitobning qaysi
// mavzusi/betigacha kelindi, necha bet qoldi va material tugab qolayotganmi.
import { PDFDocument } from "pdf-lib";
import { supabaseAi } from "./supabase-ai";
import { loadPlanHistory, type HistoryEntry } from "./plan-server";
import { todayIso } from "./dates";

export type MaterialStatus = {
  fileId: string;
  name: string;
  category: string;
  used: boolean;
  totalPages: number | null;
  passedPage: number | null; // bugungacha o'tilgan eng oxirgi bet
  plannedPage: number | null; // kelgusi rejalar bilan birga eng oxirgi bet
  lastTopic: string;
  lastDate: string;
  remainingPages: number | null;
  percent: number | null;
  lessonsLeft: number | null;
  weeksLeft: number | null;
  level: "ok" | "low" | "finished" | "unused";
};

export type GroupStatus = {
  materials: MaterialStatus[];
  totalFiles: number;
  usedFiles: number;
  unusedFiles: string[];
  warnings: string[];
};

const pageCountCache = new Map<string, number | null>();

async function pdfPageCount(fileId: string, storagePath: string): Promise<number | null> {
  if (pageCountCache.has(fileId)) return pageCountCache.get(fileId) ?? null;
  try {
    const { data } = supabaseAi.storage.from("ai-files").getPublicUrl(storagePath);
    const res = await fetch(data.publicUrl);
    if (!res.ok) throw new Error(String(res.status));
    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false });
    const n = doc.getPageCount();
    pageCountCache.set(fileId, n);
    return n;
  } catch (err) {
    console.error("PDF betlar sonini o'qib bo'lmadi:", storagePath, err);
    return null; // keshlamaymiz — keyingi safar qayta urinadi
  }
}

function pageNumbers(pages: string): number[] {
  return (pages.match(/\d+/g) ?? []).map(Number);
}

// "24-27" -> 4 bet, "24" -> 1 bet
function pageSpan(pages: string): number {
  const n = pageNumbers(pages);
  if (n.length === 0) return 0;
  return n.length === 1 ? 1 : Math.abs(n[n.length - 1] - n[0]) + 1;
}

export async function buildGroupStatus(groupId: string, lessonsPerWeek: number): Promise<GroupStatus> {
  const [history, filesRes, catsRes] = await Promise.all([
    loadPlanHistory(groupId),
    supabaseAi.from("files").select("id, name, category_id, storage_path").order("name"),
    supabaseAi.from("file_categories").select("id, name"),
  ]);
  if (filesRes.error) throw new Error(filesRes.error.message);

  const today = todayIso();
  const catName = new Map((catsRes.data ?? []).map((c) => [c.id as string, c.name as string]));
  const files = filesRes.data ?? [];

  const byMaterial = new Map<string, HistoryEntry[]>();
  for (const e of history) {
    if (e.material.trim()) byMaterial.set(e.material, [...(byMaterial.get(e.material) ?? []), e]);
  }

  const perWeek = Math.max(1, lessonsPerWeek);
  const materials: MaterialStatus[] = await Promise.all(
    files.map(async (f) => {
      const entries = byMaterial.get(f.name as string) ?? [];
      const base = {
        fileId: f.id as string,
        name: f.name as string,
        category: catName.get(f.category_id as string) ?? "Kategoriyasiz",
      };
      if (entries.length === 0) {
        return {
          ...base, used: false, totalPages: null, passedPage: null, plannedPage: null, lastTopic: "", lastDate: "",
          remainingPages: null, percent: null, lessonsLeft: null, weeksLeft: null, level: "unused" as const,
        };
      }

      const totalPages = await pdfPageCount(f.id as string, f.storage_path as string);
      const maxOf = (list: HistoryEntry[]) => {
        const nums = list.flatMap((e) => pageNumbers(e.pages));
        return nums.length ? Math.max(...nums) : null;
      };
      const passedPage = maxOf(entries.filter((e) => e.date <= today));
      const plannedPage = maxOf(entries);
      const last = entries[entries.length - 1];

      const spans = entries.map((e) => pageSpan(e.pages)).filter((n) => n > 0);
      const avg = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;
      const remainingPages = totalPages && plannedPage != null ? Math.max(0, totalPages - plannedPage) : null;
      const lessonsLeft = remainingPages != null && avg ? Math.ceil(remainingPages / avg) : null;
      const weeksLeft = lessonsLeft != null ? Math.ceil(lessonsLeft / perWeek) : null;
      const percent = totalPages && plannedPage != null ? Math.min(100, Math.round((plannedPage / totalPages) * 100)) : null;

      let level: MaterialStatus["level"] = "ok";
      if (remainingPages === 0) level = "finished";
      else if (weeksLeft != null && weeksLeft <= 3) level = "low";

      return {
        ...base, used: true, totalPages, passedPage, plannedPage, lastTopic: last.topic, lastDate: last.date,
        remainingPages, percent, lessonsLeft, weeksLeft, level,
      };
    })
  );

  const used = materials.filter((m) => m.used);
  const unusedFiles = materials.filter((m) => !m.used).map((m) => m.name);
  const warnings: string[] = [];
  for (const m of used) {
    if (m.level === "finished") warnings.push(`"${m.name}" tugadi (${m.totalPages}-bet ham rejalashtirilgan).`);
    else if (m.level === "low") warnings.push(`"${m.name}" tugayapti: taxminan ${m.lessonsLeft} dars (~${m.weeksLeft} hafta) qoldi.`);
  }
  if (used.length > 0 && used.every((m) => m.level === "finished" || m.level === "low")) {
    warnings.push(
      unusedFiles.length
        ? `Ishlatilayotgan materiallar tugab qolyapti. Ishlatilmagan materiallar: ${unusedFiles.join(", ")}.`
        : "Ishlatilayotgan materiallar tugab qolyapti va boshqa yangi material yo'q — yangi PDF yuklang (Fayllar bo'limi)."
    );
  }

  return { materials, totalFiles: files.length, usedFiles: used.length, unusedFiles, warnings };
}

export function statusToText(s: GroupStatus): string {
  if (s.totalFiles === 0) return "Hali birorta material yuklanmagan.";
  const lines = s.materials.map((m) => {
    if (!m.used) return `- "${m.name}" [${m.category}]: bu guruhda hali ishlatilmagan.`;
    const parts = [
      `- "${m.name}" [${m.category}]`,
      m.totalPages ? `jami ${m.totalPages} bet` : "jami bet soni noma'lum",
      `bugungacha o'tilgan: ${m.passedPage ?? "?"}-bet`,
      `rejalashtirilgan: ${m.plannedPage ?? "?"}-betgacha`,
      `oxirgi mavzu: ${m.lastTopic || "-"} (${m.lastDate})`,
    ];
    if (m.remainingPages != null) parts.push(`qolgan: ${m.remainingPages} bet`);
    if (m.lessonsLeft != null) parts.push(`~${m.lessonsLeft} dars / ~${m.weeksLeft} hafta`);
    if (m.level === "low") parts.push("HOLAT: TUGAYAPTI");
    if (m.level === "finished") parts.push("HOLAT: TUGADI");
    return parts.join(" | ");
  });
  return `Jami ${s.totalFiles} ta material, ${s.usedFiles} tasi shu guruhda ishlatilmoqda.\n${lines.join("\n")}`;
}
