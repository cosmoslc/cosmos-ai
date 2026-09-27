import { NextRequest, NextResponse } from "next/server";
import { geminiJson } from "@/lib/gemini";
import { supabaseAi } from "@/lib/supabase-ai";

export const runtime = "nodejs";

const schema = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string", description: "Inglizcha so'z yoki ibora" },
          translation: { type: "string", description: "O'zbekcha tarjima" },
          example: { type: "string", description: "PDF mazmuniga mos ingliz tilidagi misol jumla" },
        },
        required: ["word", "translation", "example"],
      },
    },
  },
  required: ["words"],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, topic } = body as { fileId?: string; topic?: string };

    if (!fileId) return NextResponse.json({ error: "Fayl tanlanmagan." }, { status: 400 });

    const { data: file, error: fileErr } = await supabaseAi.from("files").select("name, storage_path").eq("id", fileId).single();
    if (fileErr || !file) return NextResponse.json({ error: "Fayl topilmadi." }, { status: 404 });

    const { data: pub } = supabaseAi.storage.from("ai-files").getPublicUrl(file.storage_path);
    const fileRes = await fetch(pub.publicUrl);
    if (!fileRes.ok) return NextResponse.json({ error: "Faylni Storage'dan olishda xato." }, { status: 500 });
    const base64 = Buffer.from(await fileRes.arrayBuffer()).toString("base64");

    const cleanTopic = (topic ?? "").trim();
    const prompt = cleanTopic
      ? `Ilova qilingan PDF ichidan faqat "${cleanTopic}" mavzusiga tegishli 12-20 ta muhim inglizcha so'z va iborani top. Har biri uchun o'zbekcha tarjima va PDF mazmuniga mos ingliz tilidagi bitta misol jumla ber. Faqat JSON qaytar, boshqa hech narsa yozma.`
      : `Ilova qilingan PDF dagi eng muhim 15-20 ta inglizcha so'z va iborani top (o'quvchilar uchun eng foydalilarini tanla). Har biri uchun o'zbekcha tarjima va bitta ingliz tilidagi misol jumla ber. Faqat JSON qaytar, boshqa hech narsa yozma.`;

    const data = await geminiJson<{ words: { word: string; translation: string; example: string }[] }>({
      prompt,
      schema,
      documents: [{ base64, mimeType: "application/pdf" }],
    });

    // Natijani AI loyihadagi vocabulary_sets / vocabulary_words ga saqlaymiz.
    const { data: set, error: setErr } = await supabaseAi
      .from("vocabulary_sets")
      .insert({ file_id: fileId, topic: cleanTopic || null })
      .select("id")
      .single();
    if (setErr) throw new Error(setErr.message);

    const rows = (data.words ?? []).map((w) => ({
      set_id: set.id,
      word: w.word,
      translation: w.translation,
      example: w.example,
    }));
    if (rows.length > 0) {
      const { error: wErr } = await supabaseAi.from("vocabulary_words").insert(rows);
      if (wErr) throw new Error(wErr.message);
    }

    return NextResponse.json({ words: data.words ?? [] });
  } catch (err) {
    console.error("Vocabulary API xatosi:", err);
    const message = err instanceof Error ? err.message : "AI so'rovida xatolik yuz berdi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
