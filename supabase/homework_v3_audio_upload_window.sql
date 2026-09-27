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
