import { NextRequest, NextResponse } from "next/server";
import { geminiJson } from "@/lib/gemini";
import { supabaseAi } from "@/lib/supabase-ai";
import { DAYS, lessonDaysOf } from "@/lib/constants";
import { dayNameOf, todayIso } from "@/lib/dates";
import {
  loadFileAsBase64,
  loadPlanHistory,
  savePlannedItems,
  summarizeCoverage,
  type PlannedItem,
} from "@/lib/plan-server";
import { buildGroupStatus, statusToText } from "@/lib/material-status";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ATTACH_BYTES = 18 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 16;
const MAX_HISTORY_ENTRIES = 40;

const schema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "O'qituvchiga o'zbek tilida javob." },
    plan_items: {
      type: "array",
      description: "Saqlanishi kerak bo'lgan reja kunlari. Reja tuzilmasa bo'sh massiv.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "Dars sanasi, YYYY-MM-DD" },
          topic: { type: "string", description: "Shu kungi dars mavzusi" },
          file_name: { type: "string", description: "Materiallar ro'yxatidagi fayl nomi (aynan shunday), bo'lmasa bo'sh" },
          pages: { type: "string", description: "Bet oralig'i, masalan 24-27. PDF ilova qilinmagan bo'lsa bo'sh." },
          homework: { type: "string", description: "Shu mavzuga mos uy vazifasi" },
          replace: { type: "boolean", description: "Shu sanadagi mavjud rejani almashtirish (faqat o'qituvchi so'ragan bo'lsa)" },
        },
        required: ["date", "topic"],
      },
    },
  },
  required: ["reply", "plan_items"],
};

function buildSystemPrompt(ctx: {
  today: string;
  todayDay: string;
  groupName: string;
  lessonDays: string[];
  groupTime?: string;
  materials: string;
  attached: string[];
  history: string;
  coverage: string;
  status: string;
}): string {
  return `Sen "Cosmos AI" — ingliz tili o'quv markazi o'qituvchisining shaxsiy AI yordamchisisan. O'qituvchi bilan o'zbek tilida, qisqa va aniq gaplash.

IMKONIYATLARING
1. Dars rejasi tuzish: bir kun (masalan "ertangi dars"), shu hafta, keyingi hafta yoki bir necha hafta uchun. O'qituvchi qanday shaklda so'rasa, shunday tuz: masalan bo'limlarni ketma-ket (Reading → Listening → Writing → Speaking), faqat bitta bo'lim, ma'lum mavzu yoki kitob bo'yicha.
2. Boshqa savollarga javob berish: tushuntirish, test/mashq tayyorlash, tavsiya, tahlil. Bunday holatda plan_items bo'sh massiv bo'ladi.

QOIDALAR
1. SANALAR. Bugun: ${ctx.today} (${ctx.todayDay}). "Ertaga", "shu hafta", "keyingi hafta", "kelasi dushanba" kabi so'zlarni aniq YYYY-MM-DD sanalarga aylantir. Hafta Dushanbadan boshlanadi.
2. DARS KUNLARI. Guruh: "${ctx.groupName}"${ctx.groupTime ? `, dars vaqti ${ctx.groupTime}` : ""}. Guruhning dars kunlari: ${ctx.lessonDays.join(", ")}. Faqat shu kunlarga reja qo'y (o'qituvchi aniq boshqa kunni so'ramasa). Yakshanbaga reja qo'yilmaydi.
3. DAVOM ETISH (eng muhim). Quyidagi "OLDINGI REJALAR" va "QAYERGACHA O'TILGAN" bo'limlarini har doim o'qi. Yangi reja aynan o'sha joydan davom etsin. Avval o'tilgan yoki allaqachon rejalashtirilgan mavzu va betlarni HECH QACHON takrorlama. Faqat o'qituvchi aniq "takrorlash / qayta o'tish" desa takrorla.
4. MAVJUD REJALAR. Rejasi allaqachon bor sanaga yangi reja qo'yma (replace=false). replace=true faqat o'qituvchi o'sha kunning rejasini aniq almashtirishni yoki qayta tuzishni so'rasa. Bunday sanalar haqida o'qituvchiga ayt.
5. BETLAR. PDF ilova qilingan bo'lsa, uning haqiqiy mazmuniga tayan va bet oralig'ini aniq ko'rsat. PDF ilova qilinmagan bo'lsa bet raqamini O'YLAB TOPMA: pages ni bo'sh qoldir va o'qituvchiga chatning pastidagi "Materiallar" bo'limidan kerakli PDF ni tanlashni ayt.
6. MATERIAL. file_name faqat "MAVJUD MATERIALLAR" ro'yxatidagi nomlardan aynan biri bo'lsin (yoki bo'sh). Bo'limlar (Reading/Listening/Writing/Speaking) tartibini o'qituvchi so'rasa qat'iy bajar; so'ramasa oldingi rejalardagi tartibni davom ettir va bo'limlar muvozanatini saqla.
7. UY VAZIFASI mavzuga mos, qisqa va aniq bo'lsin.
8. Noaniq bo'lsa (masalan qaysi hafta yoki qaysi material aniq emas) — reja tuzma, bitta aniqlashtiruvchi savol ber va plan_items ni bo'sh qoldir.
9. MATERIAL HOLATI. "Qayergacha o'tdik", "qaysi kitob / qaysi mavzu", "nechta material bor", "kitob tugayaptimi" kabi savollarga "MATERIALLAR HOLATI" ma'lumotiga tayanib aniq javob ber: kitob nomi, oxirgi mavzu va bet, qolgan bet va taxminiy dars/hafta soni, nechta material bor va nechtasi ishlatilmagan. Biror kitob "TUGAYAPTI" yoki "TUGADI" holatida bo'lsa, reja tuzganingda ham o'qituvchini alohida ogohlantir va ishlatilmagan materiallardan keyingisini taklif qil. Kitob tugasa uning oxiridan keyingi betga reja qo'yma.
10. reply da nima qilganingni va qayerdan davom etganingni yoz (masalan: "Oldingi reja Unit 4, 27-betda tugagan edi, shundan davom etdim"). Ro'yxat kerak bo'lsa oddiy matn qatorlari bilan yoz (markdown belgilarsiz).

MAVJUD MATERIALLAR
${ctx.materials}
${ctx.attached.length ? `\nHOZIR ILOVA QILINGAN PDF (mazmunini o'qishing mumkin): ${ctx.attached.join(", ")}` : "\nHozir hech qanday PDF ilova qilinmagan."}

OLDINGI REJALAR (sana bo'yicha, oxirgilari)
${ctx.history}

QAYERGACHA O'TILGAN (material bo'yicha)
${ctx.coverage}

MATERIALLAR HOLATI (jami betlar, qolgani, tugash muddati)
${ctx.status}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      groupId?: string;
      groupName?: string;
      groupDays?: string[];
      groupTime?: string;
      message?: string;
      fileIds?: string[];
    };
    const { sessionId, groupId, groupName, groupDays, groupTime } = body;
    const message = body.message?.trim();
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];

    if (!sessionId || !groupId) return NextResponse.json({ error: "Guruh yoki suhbat topilmadi." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Xabar bo'sh." }, { status: 400 });

    // Suhbat tarixi (oxirgi xabarlar) va materiallar ro'yxati
    const [{ data: msgRows, error: mErr }, { data: fileRows, error: fErr }, { data: catRows }] = await Promise.all([
      supabaseAi
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY_MESSAGES),
      supabaseAi.from("files").select("id, name, category_id, size_bytes").order("created_at", { ascending: false }).limit(200),
      supabaseAi.from("file_categories").select("id, name"),
    ]);
    if (mErr) throw new Error(mErr.message);
    if (fErr) throw new Error(fErr.message);

    const catName = new Map((catRows ?? []).map((c) => [c.id as string, c.name as string]));
    const files = fileRows ?? [];
    const materials = files.length
      ? files.map((f) => `- "${f.name}" [${catName.get(f.category_id as string) ?? "Kategoriyasiz"}]`).join("\n")
      : "Hali birorta fayl yuklanmagan.";

    // Tanlangan PDF'lar (bet raqamlari aniq bo'lishi uchun)
    const chosen = files.filter((f) => fileIds.includes(f.id as string));
    const totalBytes = chosen.reduce((s, f) => s + Number(f.size_bytes ?? 0), 0);
    if (totalBytes > MAX_ATTACH_BYTES) {
      return NextResponse.json(
        { error: "Tanlangan fayllar juda katta (jami 18 MB dan oshmasin). Kamroq fayl tanlang." },
        { status: 400 }
      );
    }
    const loaded = await Promise.all(chosen.map((f) => loadFileAsBase64(f.id as string)));

    // Oldingi rejalar va "qayergacha o'tildi"
    const today = todayIso();
    const allHistory = await loadPlanHistory(groupId);
    const historyText = allHistory.length
      ? allHistory
          .slice(-MAX_HISTORY_ENTRIES)
          .map(
            (e) =>
              `${e.date} (${e.day})${e.date > today ? " [rejalashtirilgan, hali kelmagan]" : ""} | mavzu: ${e.topic || "-"} | material: ${
                e.material || "-"
              } ${e.pages || ""} | uy vazifasi: ${e.homework || "-"}`
          )
          .join("\n")
      : "Bu guruh uchun hali reja tuzilmagan — boshidan boshla.";

    const lessonDays = lessonDaysOf(groupDays);
    const status = await buildGroupStatus(groupId, lessonDays.length);
    const system = buildSystemPrompt({
      today,
      todayDay: dayNameOf(today) ?? "Yakshanba",
      groupName: groupName ?? "guruh",
      lessonDays: groupDays && groupDays.length ? lessonDays : [...DAYS],
      groupTime,
      materials,
      attached: loaded.map((f) => f.name),
      history: historyText,
      coverage: summarizeCoverage(allHistory),
      status: statusToText(status),
    });

    const history = (msgRows ?? [])
      .reverse()
      .map((m) => ({ role: (m.role === "ai" ? "model" : "user") as "user" | "model", text: m.content as string }));

    const ai = await geminiJson<{ reply: string; plan_items: PlannedItem[] }>({
      prompt: message,
      schema,
      system,
      history,
      documents: loaded.map((f) => ({ base64: f.base64, mimeType: "application/pdf" })),
    });

    const result = await savePlannedItems(groupId, ai.plan_items ?? [], allHistory);

    let reply = ai.reply?.trim() || "Tayyor.";
    if (result.saved.length) {
      reply += `\n\nSaqlandi (Guruhlar bo'limida ko'ring):\n${result.saved.map((s) => `• ${s.date} (${s.day}) — ${s.topic}`).join("\n")}`;
    }
    if (result.skipped.length) {
      reply += `\n\nO'tkazib yuborildi:\n${result.skipped.map((s) => `• ${s.date} — ${s.reason}`).join("\n")}`;
    }

    await supabaseAi.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });
    await supabaseAi.from("chat_messages").insert({ session_id: sessionId, role: "ai", content: reply });

    return NextResponse.json({ reply, saved: result.saved, skipped: result.skipped });
  } catch (err) {
    console.error("Chat API xatosi:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI so'rovida xatolik yuz berdi." }, { status: 500 });
  }
}
