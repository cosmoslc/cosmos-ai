-- Buni ASOSIY (real CRM) loyihada ishga tushiring.
-- Bitta ustun qo'shiladi — guruhga AI bot yoqilganmi.
alter table public.groups add column if not exists ai_bot_enabled boolean default false;
