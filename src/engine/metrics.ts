import type { Answers, MetricsResult } from './types'

// Knowledge quiz correct answers
const CORRECT_ANSWERS = [
  'หุ้นผันผวนและเสี่ยงสูงกว่า',
  'ลดความเสี่ยงของพอร์ต',
  'พันธบัตร',
  'ลดผลกระทบจากความผันผวนระยะสั้น',
  'กองทุนที่ซื้อขายในตลาดหุ้น',
  'ศึกษาเพิ่มก่อนลงทุน',
]

function safeDiv(num: number, den: number): number | null {
  if (den === 0 || !isFinite(den)) return null
  return num / den
}

// Normalize to 0-100, where higherIsBetter controls direction
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

export function computeMetrics(a: Answers): MetricsResult {
  const flags: string[] = []

  const totalMonthlyIncome =
    a.mainIncome + (a.annualBonus / 12) + a.sideIncome + a.passiveIncome

  const totalAssets =
    a.cash + a.bankDeposit + a.thaiStocksAsset + a.foreignStocksAsset +
    a.crypto + a.goldAsset + a.realEstate

  const totalLiabilities =
    a.mortgageDebt + a.carDebt + a.creditCardDebt + a.personalDebt

  const totalInvestmentAssets =
    a.thaiStocksAsset + a.foreignStocksAsset + a.crypto + a.goldAsset

  // emergencyMonths
  const emergencyMonths = safeDiv(a.cash + a.bankDeposit, a.monthlyExpenses)
  if (emergencyMonths === null) flags.push('monthlyExpenses=0')
  const emergencyMonthsN = emergencyMonths !== null
    ? normalize(emergencyMonths, 0, 12)
    : null

  // dti
  const dti = safeDiv(a.totalMonthlyDebtPayment, totalMonthlyIncome)
  if (dti === null) flags.push('totalMonthlyIncome=0')
  const dtiN = dti !== null ? normalize(1 - dti, 0, 1) : null // lower dti = better

  // savingsRate
  const savingsRate = safeDiv(a.monthlySavings, totalMonthlyIncome)
  if (savingsRate === null) flags.push('savingsRate:income=0')
  const savingsRateN = savingsRate !== null ? normalize(savingsRate, 0, 0.5) : null

  // netWorth
  const netWorth = totalAssets - totalLiabilities

  // yearsToRetirement
  const yearsToRetirement = Math.max(0, a.retirementAge - a.age)

  // concentration
  const maxSingleAsset = Math.max(
    a.thaiStocksAsset, a.foreignStocksAsset, a.crypto, a.goldAsset
  )
  const concentration = safeDiv(maxSingleAsset, totalInvestmentAssets)
  if (concentration === null && totalInvestmentAssets === 0) flags.push('noInvestmentAssets')
  const concentrationN = concentration !== null
    ? normalize(1 - concentration, 0, 1)
    : null

  // knowledgeScore
  const correct = (a.knowledgeAnswers || []).filter(
    (ans, i) => ans === CORRECT_ANSWERS[i]
  ).length
  const knowledgeScore = correct / 6

  // passiveRatio
  const passiveRatio = safeDiv(a.passiveIncome, totalMonthlyIncome)
  if (passiveRatio === null) flags.push('passiveRatio:income=0')
  const passiveRatioN = passiveRatio !== null ? normalize(passiveRatio, 0, 1) : null

  return {
    emergencyMonths,
    dti,
    savingsRate,
    netWorth,
    yearsToRetirement,
    concentration,
    knowledgeScore,
    passiveRatio,
    totalAssets,
    totalLiabilities,
    totalMonthlyIncome,
    totalInvestmentAssets,
    emergencyMonthsN,
    dtiN,
    savingsRateN,
    concentrationN,
    passiveRatioN,
    flags,
  }
}
