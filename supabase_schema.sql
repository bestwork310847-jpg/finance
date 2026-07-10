-- ============================================================
-- Finance Advisor — Supabase Schema (v2)
-- รันทั้งหมดใน SQL Editor ครั้งเดียว
-- ============================================================

create table if not exists assessments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid references auth.users(id) on delete cascade,
  full_name   text,
  age         int,
  occupation  text,
  province    text,
  risk_level  text,
  risk_a      numeric,
  net_worth   numeric,
  answers     jsonb,
  metrics     jsonb,
  risk_result jsonb,
  risk_cards  jsonb,
  allocation  jsonb
);

create index if not exists assessments_user_id_idx   on assessments (user_id);
create index if not exists assessments_created_at_idx on assessments (created_at desc);

alter table assessments enable row level security;

drop policy if exists "users can view own assessments"   on assessments;
drop policy if exists "users can insert own assessments" on assessments;
drop policy if exists "users can delete own assessments" on assessments;

create policy "users can view own assessments"
  on assessments for select
  using (auth.uid() = user_id);

create policy "users can insert own assessments"
  on assessments for insert
  with check (auth.uid() = user_id);

create policy "users can delete own assessments"
  on assessments for delete
  using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.assessments to authenticated;
