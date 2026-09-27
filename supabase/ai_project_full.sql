-- ============================================================
-- Cosmos AI — AI Supabase loyihasi uchun TO'LIQ, BIRLASHTIRILGAN schema.
-- (ai_project.sql + ai_project_homework.sql + ai_project_homework_v2_uploads.sql)
--
-- Bu faylni AI loyihaning SQL Editor'ida bir marta to'liq ishga tushiring.
-- Hammasi "if not exists" / "on conflict do nothing" bilan yozilgan —
-- qayta ishga tushirsangiz ham xato bermaydi (masalan ai_project.sql
-- qismi allaqachon bajarilgan bo'lsa ham).
--
-- Asosiy (real CRM) loyihaga BU FAYL HECH NARSA QILMAYDI — faqat
-- shu AI loyihaga tegishli.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Haftalik reja
-- ------------------------------------------------------------
create table if not exists weekly_plans (
  id          text primary key default gen_random_uuid()::text,
  group_id    text not null,   -- asosiy loyihadagi groups.id
  week_start  date not null default date_trunc('week', now())::date,
  created_at  timestamptz default now(),
  unique (group_id, week_start)
);

create table if not exists plan_items (
  id           text primary key default gen_random_uuid()::text,
  plan_id      text not null references weekly_plans(id) on delete cascade,
  day_of_week  text not null,
  topic        text not null default '',
  material     text not null default '',
  pages        text not null default '',
  homework     text not null default '',
  source       text not null default '',   -- '' | 'manual' | 'ai'
  updated_at   timestamptz default now(),
  unique (plan_id, day_of_week)
);

-- ------------------------------------------------------------
-- 2) Fayllar (PDF metadata — haqiqiy fayl shu loyihaning Storage'ida)
-- ------------------------------------------------------------
create table if not exists file_categories (
  id    text primary key default gen_random_uuid()::text,
  name  text not null unique
);
insert into file_categories (name)
values ('Reading'), ('Listening'), ('Writing'), ('Speaking')
on conflict (name) do nothing;

create table if not exists files (
  id           text primary key default gen_random_uuid()::text,
  category_id  text references file_categories(id) on delete set null,
  teacher_id   text,   -- asosiy loyihadagi teachers_hr.id
  name         text not null,
  storage_path text not null,
  size_bytes   bigint default 0,
  created_at   timestamptz default now()
);

-- ------------------------------------------------------------
-- 3) Lug'at
-- ------------------------------------------------------------
create table if not exists vocabulary_sets (
  id         text primary key default gen_random_uuid()::text,
  file_id    text references files(id) on delete cascade,
  topic      text,
  created_at timestamptz default now()
);

create table if not exists vocabulary_words (
  id          text primary key default gen_random_uuid()::text,
  set_id      text not null references vocabulary_sets(id) on delete cascade,
  word        text not null,
  translation text not null,
  example     text
);

-- ------------------------------------------------------------
-- 4) Print navbati
-- ------------------------------------------------------------
create table if not exists print_jobs (
  id          text primary key default gen_random_uuid()::text,
  teacher_id  text,   -- asosiy loyihadagi teachers_hr.id
  file_id     text references files(id) on delete set null,
  file_name   text not null,
  pages       text not null,
  status      text not null default 'queued', -- 'queued' | 'printing' | 'done' | 'failed'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- 5) Chat AI tarixi
-- ------------------------------------------------------------
create table if not exists chat_sessions (
  id          text primary key default gen_random_uuid()::text,
  teacher_id  text,   -- asosiy loyihadagi teachers_hr.id
  group_id    text,   -- asosiy loyihadagi groups.id
  created_at  timestamptz default now()
);

create table if not exists chat_messages (
  id          text primary key default gen_random_uuid()::text,
  session_id  text not null references chat_sessions(id) on delete cascade,
  role        text not null,  -- 'user' | 'ai'
  content     text not null,
  created_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- 6) O'quvchi login (telefon raqami + parol)
-- ------------------------------------------------------------
create table if not exists students_auth (
  id            text primary key default gen_random_uuid()::text,
  student_id    text not null unique,   -- asosiy loyihadagi students.id
  phone         text not null unique,   -- login sifatida: 998901234567
  password_hash text not null,          -- SHA-256 hex
  full_name     text not null default '',
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------
-- 7) Vazifalar (o'qituvchi guruhga beradigan uy vazifasi)
-- ------------------------------------------------------------
create table if not exists homework_assignments (
  id              text primary key default gen_random_uuid()::text,
  group_id        text not null,           -- asosiy loyihadagi groups.id
  teacher_id      text,                    -- asosiy loyihadagi teachers_hr.id
  title           text not null,
  kind            text not null default 'reading',  -- 'reading' | 'listening' | 'writing' | 'speaking'
  instructions    text not null default '',
  content_url     text,
  duration_seconds int not null default 900,
  due_at          timestamptz,
  created_at      timestamptz default now(),
  requires_upload boolean not null default false
);

-- ------------------------------------------------------------
-- 8) Har bir o'quvchining shu vazifa bo'yicha sessiyasi (timer holati)
-- ------------------------------------------------------------
create table if not exists homework_sessions (
  id                 text primary key default gen_random_uuid()::text,
  assignment_id      text not null references homework_assignments(id) on delete cascade,
  student_id         text not null,   -- asosiy loyihadagi students.id
  status             text not null default 'not_started',
  started_at         timestamptz,
  deadline_at        timestamptz,
  accumulated_seconds int not null default 0,
  last_heartbeat_at  timestamptz,
  completed_at       timestamptz,
  updated_at         timestamptz default now(),
  submission_url            text,
  submission_uploaded_at    timestamptz,
  checked                   boolean not null default false,
  checked_at                timestamptz,
  teacher_note              text,
  unique (assignment_id, student_id)
);

-- v2 fayl bilan qayta ishga tushirilsa ham xato bermasin deb "add column if not exists" bilan ham:
alter table homework_assignments add column if not exists requires_upload boolean not null default false;
alter table homework_sessions add column if not exists submission_url text;
alter table homework_sessions add column if not exists submission_uploaded_at timestamptz;
alter table homework_sessions add column if not exists checked boolean not null default false;
alter table homework_sessions add column if not exists checked_at timestamptz;
alter table homework_sessions add column if not exists teacher_note text;

create index if not exists idx_homework_sessions_student on homework_sessions(student_id);
create index if not exists idx_homework_assignments_group on homework_assignments(group_id);

-- ============================================================
-- Cosmos AI — v3: audio fayllar (ketma-ket) + fayl yuklash oynasi (server vaqti)
--
-- AI loyihaning SQL Editor'ida BIR MARTA ishga tushiring. Qayta ishga
-- tushirsangiz ham xato bermaydi. Asosiy (CRM) loyihaga tegmaydi.
--
-- Nima qiladi:
--  1) homework_assignments: audio_files (tartiblangan audio ro'yxati) va
--     upload_window_seconds (vazifa vaqti tugagach fayl yuklash uchun beriladigan vaqt).
--  2) homework_sessions: upload_opens_at / upload_deadline_at.
--  3) Trigger: barcha vaqtlar SERVER soati (now()) bilan belgilanadi —
--     telefon soatini o'zgartirib aldab bo'lmaydi. Fayl yuklash oynasi
--     yopilgach yuklangan fayl bazaga yozilmaydi (o'quvchi vazifani
--     bajarmagan hisoblanadi).
-- ============================================================

alter table homework_assignments add column if not exists audio_files jsonb not null default '[]'::jsonb;
-- [{"url": "...", "name": "1.mp3", "duration_seconds": 93}, ...]  — ijro tartibida
alter table homework_assignments add column if not exists upload_window_seconds int not null default 600;

-- Nechta rasm yuklash kerak (o'qituvchi belgilaydi) va o'quvchi yuklagan rasmlar ro'yxati.
alter table homework_assignments add column if not exists required_uploads int not null default 1;
alter table homework_sessions add column if not exists submission_urls jsonb not null default '[]'::jsonb;

alter table homework_sessions add column if not exists upload_opens_at timestamptz;
alter table homework_sessions add column if not exists upload_deadline_at timestamptz;

create or replace function homework_sessions_guard() returns trigger
language plpgsql as $$
declare
  a homework_assignments%rowtype;
  old_status text;
  old_urls jsonb;
  max_add int;
  opens timestamptz;
begin
  select * into a from homework_assignments where id = new.assignment_id;
  if not found then
    return new;
  end if;

  if tg_op = 'INSERT' then
    old_status := 'not_started';
    old_urls := '[]'::jsonb;
  else
    old_status := old.status;
    old_urls := old.submission_urls;
  end if;

  -- 1) Boshlanish vaqti va muddat — faqat server soati bilan, bir marta.
  if tg_op = 'UPDATE' and old.started_at is not null then
    new.started_at := old.started_at;
    new.deadline_at := old.deadline_at;
    -- yakunlangan/tugagan sessiyani qayta "jarayonda" qilib bo'lmaydi
    if old.status in ('completed', 'expired') and new.status <> old.status then
      new.status := old.status;
    end if;
  elsif new.status = 'in_progress' then
    new.started_at := now();
    if a.kind = 'listening' then
      new.deadline_at := null;
    else
      new.deadline_at := now() + a.duration_seconds * interval '1 second';
    end if;
  end if;

  -- 2) Tinglash: to'plangan vaqt haqiqiy o'tgan vaqtdan oshib ketmasin.
  if a.kind = 'listening' and tg_op = 'UPDATE' and new.accumulated_seconds > old.accumulated_seconds then
    max_add := floor(extract(epoch from (now() - coalesce(old.last_heartbeat_at, old.started_at, now())))) + 6;
    new.accumulated_seconds := least(new.accumulated_seconds, old.accumulated_seconds + greatest(max_add, 0));
  end if;
  if tg_op = 'UPDATE' and new.accumulated_seconds <> old.accumulated_seconds then
    new.last_heartbeat_at := now();
  end if;

  -- 3) Yakunlash / tugash — server soati bilan (mijoz yuborgan vaqtlar e'tiborga olinmaydi).
  if tg_op = 'UPDATE' then
    new.completed_at := old.completed_at;
    new.submission_uploaded_at := old.submission_uploaded_at;
  else
    new.completed_at := null;
    new.submission_uploaded_at := null;
  end if;
  if new.status = 'completed' and old_status <> 'completed' then
    if a.kind = 'listening' and new.accumulated_seconds < a.duration_seconds - 6 then
      new.status := old_status;   -- audio hali tugamagan
    else
      new.completed_at := now();
    end if;
  end if;
  if new.status = 'expired' and old_status <> 'expired' then
    if new.deadline_at is null or now() < new.deadline_at - interval '5 seconds' then
      new.status := old_status;   -- vaqt hali tugamagan
    end if;
  end if;

  -- 4) Fayl yuklash oynasi: vazifa vaqti tugagan paytdan boshlab upload_window_seconds.
  if a.kind = 'listening' then
    opens := new.completed_at;
  else
    opens := least(coalesce(new.deadline_at, 'infinity'::timestamptz), coalesce(new.completed_at, 'infinity'::timestamptz));
    if opens = 'infinity'::timestamptz then
      opens := null;
    end if;
  end if;
  new.upload_opens_at := opens;
  new.upload_deadline_at := case when opens is null then null else opens + a.upload_window_seconds * interval '1 second' end;

  -- 5) Rasmlar ro'yxati o'zgarayotgan bo'lsa (yuklash/olib tashlash): oyna ochiqmi, soni oshib ketmadimi?
  if new.submission_urls is distinct from old_urls then
    if new.started_at is null then
      raise exception 'HOMEWORK_NOT_STARTED: vazifa hali boshlanmagan';
    end if;
    if new.upload_deadline_at is not null and now() > new.upload_deadline_at then
      raise exception 'UPLOAD_WINDOW_CLOSED: fayl yuklash vaqti tugagan';
    end if;
    if jsonb_array_length(new.submission_urls) > a.required_uploads then
      raise exception 'TOO_MANY_UPLOADS: ruxsat etilgan rasm soni %', a.required_uploads;
    end if;
    new.submission_uploaded_at := now();
    new.submission_url := new.submission_urls->>0;   -- eski ko'rsatkichlar uchun birinchi rasm
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_homework_sessions_guard on homework_sessions;
create trigger trg_homework_sessions_guard
  before insert or update on homework_sessions
  for each row execute function homework_sessions_guard();

-- ============================================================
-- RLS: hozircha auth yo'q, shuning uchun ochiq policy.
-- AUTH QO'SHILGANDA BU YERNI QAYTA YOZING.
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'weekly_plans','plan_items','file_categories','files',
    'vocabulary_sets','vocabulary_words','print_jobs',
    'chat_sessions','chat_messages',
    'students_auth','homework_assignments','homework_sessions'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "dev_open_all" on %I;', t);
    execute format('create policy "dev_open_all" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Real-time: bir necha marta ishga tushirilsa ham xato bermasin
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'print_jobs'
  ) then
    alter publication supabase_realtime add table print_jobs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'homework_sessions'
  ) then
    alter publication supabase_realtime add table homework_sessions;
  end if;
end $$;

-- ============================================================
-- Storage bucket'lar
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ai-files', 'ai-files', true)
on conflict (id) do nothing;

drop policy if exists "ai-files public read" on storage.objects;
create policy "ai-files public read" on storage.objects
  for select using (bucket_id = 'ai-files');

drop policy if exists "ai-files public upload" on storage.objects;
create policy "ai-files public upload" on storage.objects
  for insert with check (bucket_id = 'ai-files');

drop policy if exists "ai-files public delete" on storage.objects;
create policy "ai-files public delete" on storage.objects
  for delete using (bucket_id = 'ai-files');

insert into storage.buckets (id, name, public)
values ('homework-submissions', 'homework-submissions', true)
on conflict (id) do nothing;

drop policy if exists "homework-submissions public read" on storage.objects;
create policy "homework-submissions public read" on storage.objects
  for select using (bucket_id = 'homework-submissions');

drop policy if exists "homework-submissions public upload" on storage.objects;
create policy "homework-submissions public upload" on storage.objects
  for insert with check (bucket_id = 'homework-submissions');

drop policy if exists "homework-submissions public delete" on storage.objects;
create policy "homework-submissions public delete" on storage.objects
  for delete using (bucket_id = 'homework-submissions');
