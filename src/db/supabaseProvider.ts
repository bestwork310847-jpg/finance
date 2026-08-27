import { supabase } from '../lib/supabase'
import type { DbProvider, CustomerRecord } from './dbTypes'
import { errorMessage, fromSupabaseError } from '../lib/errors'

export const supabaseProvider: DbProvider = {
  async saveCustomer(record) {
    if (!supabase) return { id: '', error: errorMessage('DB_NOT_CONFIGURED') }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { id: '', error: errorMessage('AUTH_REQUIRED') }
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        user_id:     user.id,
        full_name:   record.fullName,
        age:         record.age,
        occupation:  record.occupation,
        province:    record.province,
        risk_level:  record.riskLevel,
        risk_a:      record.riskA,
        net_worth:   record.netWorth,
        answers:     record.answers,
        metrics:     record.metrics,
        risk_result: record.riskResult,
        risk_cards:  record.riskCards,
        allocation:  record.allocation,
      })
      .select('id')
      .single()
    if (error) return { id: '', error: fromSupabaseError(error)!.message }
    return { id: data.id, error: null }
  },

  async getCustomers() {
    if (!supabase) return { data: [], error: errorMessage('DB_NOT_CONFIGURED') }
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { data: [], error: fromSupabaseError(error)!.message }
    return { data: (data || []).map(mapRow), error: null }
  },

  async getCustomer(id) {
    if (!supabase) return { data: null, error: errorMessage('DB_NOT_CONFIGURED') }
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return { data: null, error: fromSupabaseError(error)!.message }
    return { data: mapRow(data), error: null }
  },

  async deleteCustomer(id) {
    if (!supabase) return { error: errorMessage('DB_NOT_CONFIGURED') }
    const { error } = await supabase.from('assessments').delete().eq('id', id)
    return { error: fromSupabaseError(error)?.message ?? null }
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
