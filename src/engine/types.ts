export interface Answers {
  // Section 1 - Personal
  fullName: string
  age: number
  gender: 'ชาย' | 'หญิง' | 'อื่นๆ'
  maritalStatus: 'โสด' | 'แต่งงาน' | 'หย่าร้าง' | 'หม้าย'
  children: number
  dependents: number
  province: string
  retirementAge: number
  education: string
  occupation: string
  jobStability: 'สูง' | 'ปานกลาง' | 'ต่ำ'
  hasChronicDisease: 'ไม่มี' | 'มี'

  // Section 2 - Income
  mainIncome: number
  annualBonus: number
  sideIncome: number
  passiveIncome: number
  incomeConsistency: 'สม่ำเสมอมาก' | 'ค่อนข้างสม่ำเสมอ' | 'ผันผวน' | 'ผันผวนสูง'
  emergencyMonthsHeld: number
  layoffRisk: 'ต่ำ' | 'ปานกลาง' | 'สูง'

  // Section 3 - Expenses
  monthlyExpenses: number
  monthlySavings: number
  cashFlowProblems: 'ไม่เคย' | 'บางครั้ง' | 'บ่อย'
  creditCardOverspend: 'ไม่เคย' | 'บางครั้ง' | 'บ่อย'

  // Section 4 - Assets
  cash: number
  bankDeposit: number
  thaiStocksAsset: number
  foreignStocksAsset: number
  crypto: number
  goldAsset: number
  realEstate: number

  // Section 5 - Liabilities
  mortgageDebt: number
  carDebt: number
  creditCardDebt: number
  personalDebt: number
  totalMonthlyDebtPayment: number
  everDefaulted: 'ไม่เคย' | 'เคย'

  // Section 6 - Insurance
  hasLifeInsurance: 'ไม่มี' | 'มี'
  hasHealthInsurance: 'ไม่มี' | 'มี'
  hasCriticalIllnessInsurance: 'ไม่มี' | 'มี'

  // Section 7 - Investment experience
  hasInvestedBefore: 'ไม่เคย' | 'เคย'
  portfolioDrop20Response: 'ซื้อเพิ่ม' | 'ถือไว้' | 'ลดบางส่วน' | 'ขายทั้งหมด'
  mainDecisionFactor: 'วิเคราะห์เอง' | 'คำแนะนำผู้เชี่ยวชาญ' | 'แนวโน้มตลาดและข่าว' | 'กระแสโซเชียล'

  // Knowledge quiz answers (index 0-5)
  knowledgeAnswers: string[]

  // Section 8 - Behavior
  portfolioDrop1Month: 'ขายทั้งหมด' | 'ขายบางส่วน' | 'ถือไว้รอดู' | 'ซื้อเพิ่ม'
  marketCrashMonths: 'หยุดลงทุน' | 'ลดการลงทุน' | 'ลงเท่าเดิม' | 'เพิ่มการลงทุน'
  volatilityTolerance: 'ขาดทุนเล็กน้อยก็เครียด' | 'รับได้บ้าง' | 'รับได้ค่อนข้างมาก' | 'รับสูงได้'
  investmentStyle: 'รักษาเงินต้น' | 'สมดุลเสี่ยง-ผลตอบแทน' | 'ต้องการผลตอบแทนสูง' | 'ยอมเสี่ยงสูงมาก'

  // Section 9 - Goals
  mainGoal: string
  targetReturnPercent: number
  investmentHorizonYears: number

  // Section 10 - Tax
  annualSalary: number
  investsSSF: 'ไม่ลงทุน' | 'ลงทุน'
  investsRMF: 'ไม่ลงทุน' | 'ลงทุน'

  // Section 11 - Retirement
  monthlyExpenseAfterRetirement: number
  currentRetirementSavings: number
  expectedLifespan: number
}

export interface MetricsResult {
  emergencyMonths: number | null
  dti: number | null
  savingsRate: number | null
  netWorth: number
  yearsToRetirement: number
  concentration: number | null
  knowledgeScore: number
  passiveRatio: number | null
  totalAssets: number
  totalLiabilities: number
  totalMonthlyIncome: number
  totalInvestmentAssets: number
  // normalized 0-100
  emergencyMonthsN: number | null
  dtiN: number | null
  savingsRateN: number | null
  concentrationN: number | null
  passiveRatioN: number | null
  flags: string[]
}

export interface RiskCard {
  id: string
  name: string
  level: 'green' | 'yellow' | 'red'
  punchline: string
  advice: string
}

export interface RiskCoefficientResult {
  capacityScore: number
  toleranceScore: number
  finalScore: number
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
  A: number
  reasons: string[]
}

export interface AssetWeights {
  thaiStocks: number
  foreignStocks: number
  bonds: number
  gold: number
  cash: number
}

export interface AllocationResult {
  weights: AssetWeights
  expectedReturn: number
  expectedRisk: number
  leverageFlag: boolean
  yRisky: number
}
