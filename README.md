# Cosmos AI (EduCRM AI moduli)

## Arxitektura: 2 ta Supabase loyiha

- **Asosiy (real CRM) loyiha** — o'zgarmaydi, faqat o'qish uchun ishlatiladi:
  `teachers_hr`, `groups`, `students`. Bitta ustun qo'shiladi
  (`groups.ai_bot_enabled`).
- **AI loyiha (yangi, alohida)** — haftalik reja, fayllar, lug'at, print
  navbati, chat tarixi shu yerda, oddiy `public` schema'da. Bu ataylab
  qilingan: alohida "custom schema" (masalan `ai_crm`) yaratish PostgREST
  tomonidan **qo'lda schema-expose va grant sozlashni** talab qiladi —
  buni chetlab o'tish uchun butunlay yangi loyiha ochib, u yerda hammasi
  standart `public` schema'da (avtomatik ruxsatlar bilan) ishlaydi.

Ikki baza orasida haqiqiy foreign key yo'q (Postgres buni qo'llamaydi) —
`group_id` / `teacher_id` shunchaki matn ustuni, bog'lanish faqat kod
darajasida.

## 1. O'rnatish

    npm install
    cp .env.example .env.local

## 2. Asosiy (real CRM) loyihada

SQL Editor'da `supabase/main_project_addon.sql` ni ishga tushiring (bitta
ustun qo'shadi, xavfsiz).

`.env.local` ga shu loyihaning ma'lumotlarini kiriting (Project Settings ->
API Keys -> Publishable key):

    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

## 3. Yangi AI loyiha yaratish

1. https://supabase.com/dashboard da **yangi, bo'sh loyiha** yarating.
2. Uning SQL Editor'ida `supabase/ai_project_full.sql` ni to'liq ishga
   tushiring. Bu barcha kerakli jadvallarni (shu jumladan vazifalar/
   homework moduli), `ai-files` va `homework-submissions` Storage
   bucket'larini va Realtime'ni sozlaydi. Fayl qayta ishga tushirilsa
   ham xato bermaydi.
3. Shu loyihaning Project Settings -> API Keys dan URL va Publishable
   key'ni oling, `.env.local` ga qo'shing:

       NEXT_PUBLIC_SUPABASE_AI_URL=...
       NEXT_PUBLIC_SUPABASE_AI_PUBLISHABLE_KEY=...

Bu loyihada schema oddiy `public` bo'lgani uchun **Exposed schemas**
sozlashning hojati yo'q — standart holatda ham ishlaydi.

## 4. Gemini sozlash

    GEMINI_API_KEY=...
    GEMINI_MODEL=gemini-3.6-flash,gemini-3.5-flash-lite,gemini-2.5-flash

Kalitni https://aistudio.google.com/apikey dan oling.

## 5. Ishga tushirish

    npm run dev   # http://localhost:3000

## Nima qayerga yoziladi

| Sahifa | O'qiydi | Yozadi |
|---|---|---|
| Guruhlar | Asosiy: groups, teachers_hr, students | AI: weekly_plans, plan_items · Asosiy: groups.ai_bot_enabled |
| Fayllar | AI: files, file_categories | AI: files, ai-files Storage, weekly_plans/plan_items (AI orqali) |
| Lug'at | AI: files | AI: vocabulary_sets, vocabulary_words |
| Print | AI: print_jobs (real-time) | AI: print_jobs |
| Chat | AI: chat_sessions, chat_messages | AI: chat_sessions, chat_messages |

## Muhim xavfsizlik eslatmasi

Ikkala loyihada ham hozircha **auth yo'q**, RLS "dev_open_all" (hammaga
ochiq). Bu vaqtinchalik qaror. Auth qo'shilguncha loyihani jamoat
internetiga chiqarmang — faqat lokal yoki ichki tarmoqda ishlating.

## Keyingi tabiiy qadamlar

1. Auth qo'shish (asosiy loyihadagi `teachers_hr.password_hash` orqali
   login, JWT, va ikkala loyihada RLS'ni qattiqlashtirish).
2. Chat AI'ni Gemini'ga ulash.
3. Print navbatini haqiqiy printerga ulash.
