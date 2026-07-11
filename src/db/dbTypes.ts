import type { Answers, MetricsResult, RiskCoefficientResult, RiskCard, AllocationResult } from '../engine/types'

export interface CustomerRecord {
  id?: string
  createdAt?: string
  userId?: string
  fullName: string
  age: number
  occupation: string
  province: string
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
  riskA: number
  netWorth: number
  answers: Answers
  metrics: MetricsResult
  riskResult: RiskCoefficientResult
  riskCards: RiskCard[]
  allocation: AllocationResult | null
}

export interface DbProvider {
  saveCustomer(record: Omit<CustomerRecord, 'id' | 'createdAt'>): Promise<{ id: string; error: string | null }>
  getCustomers(): Promise<{ data: CustomerRecord[]; error: string | null }>
  getCustomer(id: string): Promise<{ data: CustomerRecord | null; error: string | null }>
  deleteCustomer(id: string): Promise<{ error: string | null }>
}
