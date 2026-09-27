// ALOHIDA "AI" Supabase loyihasi uchun client. Haftalik reja, fayllar,
// lug'at, print navbati va chat tarixi shu yerda saqlanadi (oddiy
// public schema'da — schema expose/grant muammolaridan qochish uchun).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_AI_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_AI_PUBLISHABLE_KEY ?? "";

if (!url || !publishableKey) {
  console.warn(
    "AI Supabase sozlanmagan: .env.local ga NEXT_PUBLIC_SUPABASE_AI_URL va NEXT_PUBLIC_SUPABASE_AI_PUBLISHABLE_KEY qo'shing."
  );
}

export const supabaseAi = createClient(url, publishableKey);
