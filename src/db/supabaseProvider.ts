import { createClient } from '@supabase/supabase-js'
import type { DbProvider, CustomerRecord } from './dbTypes'

// ใส่ค่าจาก Supabase Dashboard → Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('กรุณาตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env')
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export const supabaseProvider: DbProvider = {
  async saveCustomer(record) {
    try {
      const supabase = getClient()
      const { data, error } = await supabase
        .from('customers')
        .insert({
          full_name: record.fullName,
          age: record.age,
          occupation: record.occupation,
          province: record.province,
          risk_level: record.riskLevel,
          risk_a: record.riskA,
          net_worth: record.netWorth,
          answers: record.answers,
          metrics: record.metrics,
          risk_result: record.riskResult,
          risk_cards: record.riskCards,
          allocation: record.allocation,
        })
        .select('id')
        .single()
      if (error) return { id: '', error: error.message }
      return { id: data.id, error: null }
    } catch (e: unknown) {
      return { id: '', error: e instanceof Error ? e.message : 'Unknown error' }
    }
  },

  async getCustomers() {
    try {
      const supabase = getClient()
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return { data: [], error: error.message }
      return { data: (data || []).map(mapRow), error: null }
    } catch (e: unknown) {
      return { data: [], error: e instanceof Error ? e.message : 'Unknown error' }
    }
  },

  async getCustomer(id) {
    try {
      const supabase = getClient()
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return { data: null, error: error.message }
      return { data: mapRow(data), error: null }
    } catch (e: unknown) {
      return { data: null, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  },

  async deleteCustomer(id) {
    try {
      const supabase = getClient()
      const { error } = await supabase.from('customers').delete().eq('id', id)
      return { error: error?.message ?? null }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Unknown error' }
    }
  },
}

function mapRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    fullName: row.full_name as string,
    age: row.age as number,
    occupation: row.occupation as string,
    province: row.province as string,
    riskLevel: row.risk_level as CustomerRecord['riskLevel'],
    riskA: row.risk_a as number,
    netWorth: row.net_worth as number,
    answers: row.answers as CustomerRecord['answers'],
    metrics: row.metrics as CustomerRecord['metrics'],
    riskResult: row.risk_result as CustomerRecord['riskResult'],
    riskCards: row.risk_cards as CustomerRecord['riskCards'],
    allocation: row.allocation as CustomerRecord['allocation'],
  }
}
