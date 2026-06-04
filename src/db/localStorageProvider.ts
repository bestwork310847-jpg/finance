// Fallback provider — เก็บใน browser localStorage
// ใช้ตอนยังไม่ได้ตั้งค่า Supabase หรือทดสอบ offline
import type { DbProvider, CustomerRecord } from './dbTypes'

const KEY = 'finance_customers'

function load(): CustomerRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function save(records: CustomerRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records))
}

export const localStorageProvider: DbProvider = {
  async saveCustomer(record) {
    const records = load()
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const newRecord: CustomerRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    }
    records.unshift(newRecord)
    save(records)
    return { id, error: null }
  },

  async getCustomers() {
    return { data: load(), error: null }
  },

  async getCustomer(id) {
    const found = load().find(r => r.id === id) ?? null
    return { data: found, error: found ? null : 'ไม่พบข้อมูล' }
  },

  async deleteCustomer(id) {
    const records = load().filter(r => r.id !== id)
    save(records)
    return { error: null }
  },
}
