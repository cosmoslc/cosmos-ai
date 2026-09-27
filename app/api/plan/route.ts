import { NextRequest, NextResponse } from "next/server";
import { geminiJson } from "@/lib/gemini";
import { supabaseAi } from "@/lib/supabase-ai";
import { DAYS } from "@/lib/constants";
import { mondayOf, todayIso } from "@/lib/dates";

export const runtime = "nodejs";

const schema = {
  type: "object",
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string", enum: [...DAYS] },
          file_name: { type: "string", description: "Ilova qilingan fayllardan qaysi biri ishlatilishi kerak" },
          topic: { type: "string", description: "Shu kungi dars mavzusi" },
          pages: { type: "string", description: "Fayldagi tegishli bet oralig'i, masalan 24-27" },
          homework: { type: "string", description: "Shu mavzuga mos uy vazifasi" },
        },
        required: ["day", "topic", "pages", "homework"],
      },
    },
  },
  required: ["days"],
};

function startOfWeekIso(): string {
  return mondayOf(todayIso());
}

async function loadFileAsBase64(fileId: string): Promise<{ name: string; base64: string }> {
  const { data: file, error } = await supabaseAi.from("files").select("name, storage_path").eq("id", fileId).single();
  if (error || !file) throw new Error("Fayl topilmadi (bazadan o'chirilgan bo'lishi mumkin).");

  const { data: pub } = supabaseAi.storage.from("ai-files").getPublicUrl(file.storage_path);
  const res = await fetch(pub.publicUrl);
  if (!res.ok) throw new Error(`Faylni Storage'dan olishda xato: ${file.name}`);

  const buf = Buffer.from(await res.arrayBuffer());
  return { name: file.name, base64: buf.toString("base64") };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { groupId, groupName, fileIds, level } = body as {
      groupId?: string;
      groupName?: string;
      fileIds?: string[];
      level?: string;
    };

    if (!groupId) return NextResponse.json({ error: "Guruh tanlanmagan." }, { status: 400 });
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "Kamida bitta fayl tanlang." }, { status: 400 });
    }

    const loaded = await Promise.all(fileIds.map(loadFileAsBase64));
    const documents = loaded.map((f) => ({ base64: f.base64, mimeType: "application/pdf" }));
    const fileNames = loaded.map((f) => f.name).join(", ");

    const prompt = `Sen ingliz tili o'quv markazida ishlaydigan o'qituvchining AI yordamchisisan. "${
      groupName ?? "guruh"
    }" guruhi${level ? ` (daraja: ${level})` : ""} uchun bir haftalik dars rejasini tuz. Faqat shu ${
      DAYS.length
    } kun uchun reja ber: ${DAYS.join(", ")}. Senga ilova qilingan PDF fayllar: ${fileNames}. Har bir kun uchun: mavzu (topic), qaysi fayldan foydalanish kerakligini (file_name — aynan yuqoridagi fayl nomlaridan biri), o'sha fayldagi tegishli bet oralig'ini (pages) va shu mavzuga mos uy vazifasini (homework) belgila. Mavzular ketma-ket rivojlansin va bir-birini takrorlamasin, PDF mazmuniga aniq mos kelsin. Faqat JSON qaytar, boshqa hech narsa yozma.`;

    const data = await geminiJson<{
      days: { day: string; file_name?: string; topic: string; pages: string; homework: string }[];
    }>({ prompt, schema, documents });

    // Natijani AI loyihadagi weekly_plans / plan_items ga saqlaymiz.
    const weekStart = startOfWeekIso();
    let planId: string;
    const { data: existingPlan, error: selErr } = await supabaseAi
      .from("weekly_plans")
      .select("id")
      .eq("group_id", groupId)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    if (existingPlan) {
      planId = existingPlan.id as string;
    } else {
      const { data: createdPlan, error: insErr } = await supabaseAi
        .from("weekly_plans")
        .insert({ group_id: groupId, week_start: weekStart })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      planId = createdPlan.id as string;
    }

    const rows = data.days
      .filter((d) => (DAYS as readonly string[]).includes(d.day))
      .map((d) => ({
        plan_id: planId,
        day_of_week: d.day,
        topic: d.topic,
        material: d.file_name ?? "",
        pages: d.pages,
        homework: d.homework,
        source: "ai",
      }));

    if (rows.length > 0) {
      const { error: upErr } = await supabaseAi.from("plan_items").upsert(rows, { onConflict: "plan_id,day_of_week" });
      if (upErr) throw new Error(upErr.message);
    }

    return NextResponse.json({ days: data.days });
  } catch (err) {
    console.error("Plan API xatosi:", err);
    const message = err instanceof Error ? err.message : "AI so'rovida xatolik yuz berdi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
