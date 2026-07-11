import { supabase } from '../lib/supabase'
import type { DbProvider, CustomerRecord } from './dbTypes'

export const supabaseProvider: DbProvider = {
  async saveCustomer(record) {
    if (!supabase) return { id: '', error: 'Supabase ไม่ได้ตั้งค่า' }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { id: '', error: 'กรุณาล็อกอินก่อนบันทึก' }
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        user_id:    user.id,
        full_name:  record.fullName,
        age:        record.age,
        occupation: record.occupation,
        province:   record.province,
        risk_level: record.riskLevel,
        risk_a:     record.riskA,
        net_worth:  record.netWorth,
        answers:    record.answers,
        metrics:    record.metrics,
        risk_result: record.riskResult,
        risk_cards:  record.riskCards,
        allocation:  record.allocation,
      })
      .select('id')
      .single()
    if (error) return { id: '', error: error.message }
    return { id: data.id, error: null }
  },

  async getCustomers() {
    if (!supabase) return { data: [], error: 'Supabase ไม่ได้ตั้งค่า' }
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: (data || []).map(mapRow), error: null }
  },

  async getCustomer(id) {
    if (!supabase) return { data: null, error: 'Supabase ไม่ได้ตั้งค่า' }
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return { data: null, error: error.message }
    return { data: mapRow(data), error: null }
  },

  async deleteCustomer(id) {
    if (!supabase) return { error: 'Supabase ไม่ได้ตั้งค่า' }
    const { error } = await supabase.from('assessments').delete().eq('id', id)
    return { error: error?.message ?? null }
  },
}

function mapRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id:         row.id as string,
    createdAt:  row.created_at as string,
    userId:     row.user_id as string,
    fullName:   row.full_name as string,
    age:        row.age as number,
    occupation: row.occupation as string,
    province:   row.province as string,
    riskLevel:  row.risk_level as CustomerRecord['riskLevel'],
    riskA:      row.risk_a as number,
    netWorth:   row.net_worth as number,
    answers:    row.answers as CustomerRecord['answers'],
    metrics:    row.metrics as CustomerRecord['metrics'],
    riskResult: row.risk_result as CustomerRecord['riskResult'],
    riskCards:  row.risk_cards as CustomerRecord['riskCards'],
    allocation: row.allocation as CustomerRecord['allocation'],
  }
}
