// ASOSIY (real CRM) loyiha uchun client. Faqat o'qish uchun ishlatiladi:
// teachers_hr, groups, students. Yozish faqat groups.ai_bot_enabled
// ustuniga (bot yoqish/o'chirish).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!url || !publishableKey) {
  console.warn(
    "Asosiy Supabase sozlanmagan: .env.local ga NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY qo'shing."
  );
}

export const supabase = createClient(url, publishableKey);
