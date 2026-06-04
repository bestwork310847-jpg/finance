// จุดเดียวที่ตัดสินใจว่าใช้ provider ไหน
// เปลี่ยนที่นี่ที่เดียวเมื่ออยากสลับ database
import { supabaseProvider } from './supabaseProvider'
import { localStorageProvider } from './localStorageProvider'

const hasSupabaseConfig =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY

// ถ้าตั้งค่า Supabase แล้ว → ใช้ Supabase
// ยังไม่ได้ตั้ง → ใช้ localStorage เป็น fallback
export const db = hasSupabaseConfig ? supabaseProvider : localStorageProvider
export const dbMode = hasSupabaseConfig ? 'supabase' : 'localStorage'

export type { CustomerRecord, DbProvider } from './dbTypes'
