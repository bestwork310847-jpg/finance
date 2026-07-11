-- ============================================================
-- Finance Advisor — Supabase Schema (v2)
-- รันทั้งหมดใน SQL Editor ครั้งเดียว
-- ============================================================

-- 1. ตาราง assessments (แทน customers เดิม)
create table if not exists assessments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid references auth.users(id) on delete cascade,

  -- ข้อมูลสรุป (ค้นหา/กรองได้เร็ว)
  full_name   text,
  age         int,
  occupation  text,
  province    text,
  risk_level  text,
  risk_a      numeric,
  net_worth   numeric,

  -- snapshot เต็ม (JSON)
  answers     jsonb,
  metrics     jsonb,
  risk_result jsonb,
  risk_cards  jsonb,
  allocation  jsonb
);

-- 2. Index
create index if not exists assessments_user_id_idx   on assessments (user_id);
create index if not exists assessments_created_at_idx on assessments (created_at desc);

-- 3. Row Level Security — แต่ละคนเห็นเฉพาะข้อมูลตัวเอง
alter table assessments enable row level security;

-- ลบ policy เก่าก่อน (ถ้ามี)
drop policy if exists "users can view own assessments"   on assessments;
drop policy if exists "users can insert own assessments" on assessments;
drop policy if exists "users can delete own assessments" on assessments;

-- สร้าง policy ใหม่
create policy "users can view own assessments"
  on assessments for select
  using (auth.uid() = user_id);

create policy "users can insert own assessments"
  on assessments for insert
  with check (auth.uid() = user_id);

create policy "users can delete own assessments"
  on assessments for delete
  using (auth.uid() = user_id);

-- 4. Admin policy (ทำหลังรู้ UUID ของแอดมินแล้ว)
--    1) ไปที่ Authentication → Users ในแดชบอร์ด Supabase
--    2) คัดลอก UUID ของบัญชีแอดมิน
--    3) แทนที่ 'ใส่-UUID-แอดมิน-ที่นี่' ด้วย UUID จริง แล้วรัน 3 คำสั่งนี้:

-- drop policy if exists "admin can view all assessments"   on assessments;
-- drop policy if exists "admin can delete all assessments" on assessments;
-- create policy "admin can view all assessments"
--   on assessments for select
--   using (auth.uid() = user_id OR auth.uid() = 'ใส่-UUID-แอดมิน-ที่นี่'::uuid);
-- create policy "admin can delete all assessments"
--   on assessments for delete
--   using (auth.uid() = user_id OR auth.uid() = 'ใส่-UUID-แอดมิน-ที่นี่'::uuid);

-- 5. Grant (anon ไม่เห็นข้อมูลเพราะ RLS กรองออก)
grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.assessments to authenticated;

-- 5. ตาราง customers เก่า (เก็บไว้ถ้ามีอยู่แล้ว)
-- ถ้าเพิ่งสร้าง project ใหม่ไม่ต้องสนใจส่วนนี้
-- drop table if exists customers;
