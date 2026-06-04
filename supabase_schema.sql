-- รัน SQL นี้ใน Supabase Dashboard → SQL Editor
-- สร้าง 1 ครั้ง แล้วใช้ได้เลย

create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),

  -- ข้อมูลสรุป (ค้นหา/กรองได้เร็ว)
  full_name   text not null,
  age         int,
  occupation  text,
  province    text,
  risk_level  text,   -- conservative / moderate / aggressive
  risk_a      numeric,
  net_worth   numeric,

  -- snapshot เต็ม (JSON)
  answers     jsonb,
  metrics     jsonb,
  risk_result jsonb,
  risk_cards  jsonb,
  allocation  jsonb
);

-- index สำหรับค้นหา/เรียงลำดับ
create index if not exists customers_created_at_idx on customers (created_at desc);
create index if not exists customers_risk_level_idx on customers (risk_level);
create index if not exists customers_full_name_idx on customers using gin (to_tsvector('simple', full_name));

-- Row Level Security (ปิดไว้ก่อน — เปิดเมื่อเพิ่ม auth)
alter table customers disable row level security;
