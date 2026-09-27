// Faqat serverda ishlaydi (API route ichida). GEMINI_API_KEY hech qachon
// clientga (brauzerga) yuborilmaydi.
import { GoogleGenAI } from "@google/genai";

// Vergul bilan ajratilgan ro'yxat bo'lishi mumkin: birinchisi band/xato
// bersa, kod avtomatik keyingisiga o'tadi. gemini-2.5-flash oktabr 2026'da
// butunlay o'chiriladi, shuning uchun zanjirning oxirida turibdi.
const MODEL_CANDIDATES = (process.env.GEMINI_MODEL || "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-2.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi. .env.local faylga qo'shing.");
  }
  return new GoogleGenAI({ apiKey });
}

type GeminiDocument = { base64: string; mimeType: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini serverlari band bo'lganda (503) yoki vaqtincha limitga tushganda
// (429) qaytaradigan xatolar. Bunday hollarda darhol muvaffaqiyatsiz deb
// e'lon qilish o'rniga, kichik kutish bilan 1-2 marta qayta urinamiz.
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /"code":\s*(503|429)|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
}

// Model umuman topilmasa/o'chirilgan bo'lsa (404) — qayta urinishdan
// ma'nosi yo'q, darhol keyingi modelga o'tish kerak.
function isModelMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /"code":\s*404|NOT_FOUND/i.test(msg);
}

/**
 * Gemini'ga (ixtiyoriy) PDF fayllar va matnli buyruq yuboradi,
 * javobni berilgan JSON schema bo'yicha qat'iy JSON qilib qaytaradi.
 * Vaqtinchalik server xatolarida (503/429) avtomatik qayta urinadi.
 */
export async function geminiJson<T>(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  documents?: GeminiDocument[];
  maxRetriesPerModel?: number;
  system?: string;
  history?: { role: "user" | "model"; text: string }[];
}): Promise<T> {
  const ai = client();
  const maxRetries = opts.maxRetriesPerModel ?? 1;

  const parts: Array<Record<string, unknown>> = [];
  for (const doc of opts.documents ?? []) {
    parts.push({ inlineData: { mimeType: doc.mimeType, data: doc.base64 } });
  }
  parts.push({ text: opts.prompt });

  let lastErr: unknown;

  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
            { role: "user", parts },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: opts.schema,
            ...(opts.system ? { systemInstruction: opts.system } : {}),
          },
        });

        const text = response.text;
        if (!text) throw new Error("Gemini bo'sh javob qaytardi.");

        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error("Gemini javobini o'qib bo'lmadi (JSON emas).");
        }
      } catch (err) {
        lastErr = err;
        console.error(`Gemini xatosi (model: ${model}, urinish: ${attempt + 1}):`, err);

        if (isModelMissing(err)) break; // bu model umuman yo'q — keyingisiga o'tamiz
        if (attempt < maxRetries && isRetryable(err)) {
          await sleep(800 * 2 ** attempt); // 800ms, 1600ms, ...
          continue;
        }
        break; // shu modelda urinishlar tugadi — keyingi modelga o'tamiz
      }
    }
  }

  if (isRetryable(lastErr)) {
    throw new Error("Google Gemini serverlari hozir band. Bir necha soniyadan so'ng qayta urinib ko'ring.");
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gemini bilan bog'lanishda noma'lum xatolik.");
}
