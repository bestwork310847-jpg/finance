import type { MetricsResult, RiskCoefficientResult, RiskCard, AllocationResult } from '../engine/types'

const DISCLAIMER = 'ข้อมูลนี้เป็นการประเมินเบื้องต้นเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน'

function escapeCsv(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function row(...cols: (string | number | null | undefined)[]) {
  return cols.map(escapeCsv).join(',')
}

export function exportMetricsCSV(
  metrics: MetricsResult,
  riskResult: RiskCoefficientResult,
  riskCards: RiskCard[],
  allocation: AllocationResult | null,
  name = 'ผู้ใช้'
) {
  const lines: string[] = []
  const now = new Date().toLocaleDateString('th-TH')

  lines.push(row('ที่ปรึกษาการเงิน — ผลการประเมิน'))
  lines.push(row('ชื่อ', name))
  lines.push(row('วันที่ประเมิน', now))
  lines.push(row('Disclaimer', DISCLAIMER))
  lines.push('')

  lines.push(row('=== ตัวชี้วัดทางการเงิน ==='))
  lines.push(row('ตัวชี้วัด', 'ค่า', 'หน่วย'))
  lines.push(row('ทรัพย์สินสุทธิ (Net Worth)', metrics.netWorth, 'บาท'))
  lines.push(row('รายได้รวม/เดือน', metrics.totalMonthlyIncome, 'บาท'))
  lines.push(row('ทรัพย์สินรวม', metrics.totalAssets, 'บาท'))
  lines.push(row('หนี้สินรวม', metrics.totalLiabilities, 'บาท'))
  lines.push(row('เงินสำรองฉุกเฉิน', metrics.emergencyMonths?.toFixed(1) ?? 'N/A', 'เดือน'))
  lines.push(row('อัตราภาระหนี้ (DTI)', metrics.dti != null ? (metrics.dti * 100).toFixed(1) : 'N/A', '%'))
  lines.push(row('อัตราการออม', metrics.savingsRate != null ? (metrics.savingsRate * 100).toFixed(1) : 'N/A', '%'))
  lines.push(row('ปีเหลือก่อนเกษียณ', metrics.yearsToRetirement, 'ปี'))
  lines.push(row('คะแนนความรู้การลงทุน', (metrics.knowledgeScore * 6).toFixed(0) + '/6', 'ข้อ'))
  lines.push('')

  lines.push(row('=== ผลการประเมินความเสี่ยง ==='))
  lines.push(row('Capacity Score', riskResult.capacityScore.toFixed(1), '/100'))
  lines.push(row('Tolerance Score', riskResult.toleranceScore.toFixed(1), '/100'))
  lines.push(row('Final Score', riskResult.finalScore.toFixed(1), '/100'))
  lines.push(row('ระดับความเสี่ยง', riskResult.riskLevel))
  lines.push(row('ค่า A (Risk Aversion)', riskResult.A.toFixed(2)))
  lines.push('')

  lines.push(row('=== การ์ดความเสี่ยง ==='))
  lines.push(row('ด้าน', 'ระดับ', 'สรุป', 'คำแนะนำ'))
  riskCards.forEach(c => lines.push(row(c.name, c.level, c.punchline, c.advice)))
  lines.push('')

  if (allocation) {
    lines.push(row('=== สัดส่วนพอร์ตที่แนะนำ ==='))
    lines.push(row('สินทรัพย์', 'สัดส่วน (%)'))
    lines.push(row('หุ้นไทย', (allocation.weights.thaiStocks * 100).toFixed(1)))
    lines.push(row('หุ้นต่างประเทศ', (allocation.weights.foreignStocks * 100).toFixed(1)))
    lines.push(row('ตราสารหนี้', (allocation.weights.bonds * 100).toFixed(1)))
    lines.push(row('ทองคำ', (allocation.weights.gold * 100).toFixed(1)))
    lines.push(row('เงินสด/พันธบัตรรัฐ', (allocation.weights.cash * 100).toFixed(1)))
    lines.push(row('ผลตอบแทนคาดหวัง/ปี', (allocation.expectedReturn * 100).toFixed(1), '%'))
    lines.push(row('ความเสี่ยง (σ)', (allocation.expectedRisk * 100).toFixed(1), '%'))
  }

  const csv = lines.join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financial-assessment-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
