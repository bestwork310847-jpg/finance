import type { Answers, MetricsResult, RiskCoefficientResult } from './types'

// ---- CONSTANTS (tune here) ----
const CAPACITY_WEIGHTS = {
  yearsToRetirement: 0.25,
  incomeStability: 0.25,
  emergencyMonths: 0.20,
  dti: 0.15,
  dependents: 0.10,
  healthAge: 0.05,
}

const KNOWLEDGE_GATE_THRESHOLD = 0.5
const KNOWLEDGE_GATE_PENALTY = 15 // points to subtract

// Map select values to 0-100 scores
function incomeStabilityScore(a: Answers): number {
  const stabilityMap: Record<string, number> = {
    'สูง': 80, 'ปานกลาง': 50, 'ต่ำ': 20,
  }
  const layoffMap: Record<string, number> = {
    'ต่ำ': 80, 'ปานกลาง': 50, 'สูง': 20,
  }
  return (stabilityMap[a.jobStability] + layoffMap[a.layoffRisk]) / 2
}

function emergencyScore(months: number | null): number {
  if (months === null) return 30
  if (months >= 12) return 100
  if (months >= 6) return 70
  if (months >= 3) return 40
  return 10
}

function dtiScore(dti: number | null): number {
  if (dti === null) return 50
  if (dti <= 0.15) return 100
  if (dti <= 0.30) return 70
  if (dti <= 0.40) return 40
  return 10
}

function dependentsScore(dependents: number): number {
  if (dependents === 0) return 100
  if (dependents === 1) return 70
  if (dependents <= 3) return 40
  return 20
}

function healthAgeScore(a: Answers): number {
  const ageScore = a.age < 30 ? 90 : a.age < 45 ? 70 : a.age < 55 ? 50 : 30
  const healthPenalty = a.hasChronicDisease === 'มี' ? 20 : 0
  return Math.max(0, ageScore - healthPenalty)
}

function yearsToRetirementScore(years: number): number {
  if (years >= 30) return 100
  if (years >= 20) return 75
  if (years >= 10) return 50
  if (years >= 5) return 25
  return 10
}

// Tolerance: behavioral/subjective
function computeToleranceScore(a: Answers): number {
  let score = 0

  const drop1mMap: Record<string, number> = {
    'ขายทั้งหมด': 10, 'ขายบางส่วน': 35, 'ถือไว้รอดู': 65, 'ซื้อเพิ่ม': 90,
  }
  score += (drop1mMap[a.portfolioDrop1Month] ?? 50) * 0.30

  const crashMap: Record<string, number> = {
    'หยุดลงทุน': 10, 'ลดการลงทุน': 35, 'ลงเท่าเดิม': 65, 'เพิ่มการลงทุน': 90,
  }
  score += (crashMap[a.marketCrashMonths] ?? 50) * 0.25

  const volMap: Record<string, number> = {
    'ขาดทุนเล็กน้อยก็เครียด': 10, 'รับได้บ้าง': 40,
    'รับได้ค่อนข้างมาก': 70, 'รับสูงได้': 95,
  }
  score += (volMap[a.volatilityTolerance] ?? 50) * 0.25

  const styleMap: Record<string, number> = {
    'รักษาเงินต้น': 10, 'สมดุลเสี่ยง-ผลตอบแทน': 45,
    'ต้องการผลตอบแทนสูง': 75, 'ยอมเสี่ยงสูงมาก': 95,
  }
  score += (styleMap[a.investmentStyle] ?? 50) * 0.20

  return Math.max(0, Math.min(100, score))
}

export function computeRiskCoefficient(
  metrics: MetricsResult,
  a: Answers
): RiskCoefficientResult {
  const ytr = yearsToRetirementScore(metrics.yearsToRetirement)
  const inc = incomeStabilityScore(a)
  const emg = emergencyScore(metrics.emergencyMonths)
  const dtiS = dtiScore(metrics.dti)
  const dep = dependentsScore(a.dependents)
  const hal = healthAgeScore(a)

  const capacityScore =
    ytr * CAPACITY_WEIGHTS.yearsToRetirement +
    inc * CAPACITY_WEIGHTS.incomeStability +
    emg * CAPACITY_WEIGHTS.emergencyMonths +
    dtiS * CAPACITY_WEIGHTS.dti +
    dep * CAPACITY_WEIGHTS.dependents +
    hal * CAPACITY_WEIGHTS.healthAge

  const toleranceScore = computeToleranceScore(a)

  let finalScore = Math.min(capacityScore, toleranceScore)

  // Knowledge gate
  if (toleranceScore > capacityScore && metrics.knowledgeScore < KNOWLEDGE_GATE_THRESHOLD) {
    finalScore = Math.max(0, finalScore - KNOWLEDGE_GATE_PENALTY)
  }

  const riskLevel =
    finalScore <= 33 ? 'conservative' :
    finalScore <= 66 ? 'moderate' : 'aggressive'

  const A = Math.max(2, Math.min(8, 2 + (100 - finalScore) / 100 * 6))

  const reasons: string[] = []
  if (ytr < 50) reasons.push(`เหลือเวลาเกษียณ ${metrics.yearsToRetirement} ปี จำกัดการรับความเสี่ยงได้`)
  if (inc < 50) reasons.push('ความมั่นคงของรายได้ยังต่ำ')
  if (emg < 40) reasons.push('เงินสำรองฉุกเฉินยังไม่เพียงพอ')
  if (dtiS < 40) reasons.push('ภาระหนี้สูงเกินไป')
  if (toleranceScore < capacityScore) reasons.push('คุณรู้สึกไม่สบายใจกับความผันผวน จึงใช้คะแนนความเต็มใจเป็นเกณฑ์')
  if (metrics.knowledgeScore >= KNOWLEDGE_GATE_THRESHOLD) reasons.push('ความรู้การลงทุนอยู่ในระดับดี')

  return { capacityScore, toleranceScore, finalScore, riskLevel, A, reasons }
}
