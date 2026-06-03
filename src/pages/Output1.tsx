import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { MetricCard } from '../components/MetricCard'
import { RiskCardComponent } from '../components/RiskCard'
import { Disclaimer } from '../components/Disclaimer'

function fmtBaht(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' ล้านบาท'
  return n.toLocaleString('th-TH') + ' บาท'
}
function fmtPct(n: number): string { return (n * 100).toFixed(1) + '%' }
function fmtMonths(n: number): string { return n.toFixed(1) + ' เดือน' }

const riskLevelLabel: Record<string, { label: string; color: string; desc: string }> = {
  conservative: { label: 'Conservative — รักษาความมั่นคง', color: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'เหมาะกับการลงทุนที่เน้นความมั่นคงของเงินต้น ยอมรับผลตอบแทนน้อยแลกกับความเสี่ยงต่ำ' },
  moderate:      { label: 'Moderate — สมดุล', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', desc: 'รับความเสี่ยงได้ปานกลาง มุ่งสร้างผลตอบแทนสม่ำเสมอในระยะกลาง' },
  aggressive:    { label: 'Aggressive — เน้นเติบโต', color: 'bg-red-100 text-red-800 border-red-300', desc: 'รับความเสี่ยงสูงได้ มุ่งเน้นผลตอบแทนสูงในระยะยาว' },
}

export default function Output1() {
  const { state } = useApp()
  const navigate = useNavigate()
  const { metrics, riskResult, riskCards } = state

  if (!metrics || !riskResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ยังไม่มีข้อมูล กรุณาทำแบบสอบถามก่อน</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
            เริ่มต้น
          </button>
        </div>
      </div>
    )
  }

  const rl = riskLevelLabel[riskResult.riskLevel]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ตัวคุณในเชิงตัวเลข</h1>
          <p className="text-sm text-gray-500">Output 1 — ภาพรวมฐานะการเงินและความเสี่ยง</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <MetricCard
            label="ทรัพย์สินสุทธิ"
            value={fmtBaht(metrics.netWorth)}
            color={metrics.netWorth >= 0 ? 'green' : 'red'}
          />
          <MetricCard
            label="เงินสำรองฉุกเฉิน"
            value={metrics.emergencyMonths !== null ? fmtMonths(metrics.emergencyMonths) : 'ไม่มีข้อมูล'}
            sub="เป้าหมาย 6 เดือน"
            color={metrics.emergencyMonths === null ? 'default' : metrics.emergencyMonths >= 6 ? 'green' : metrics.emergencyMonths >= 3 ? 'yellow' : 'red'}
          />
          <MetricCard
            label="อัตราภาระหนี้ (DTI)"
            value={metrics.dti !== null ? fmtPct(metrics.dti) : 'ไม่มีข้อมูล'}
            sub="เกิน 40% = อันตราย"
            color={metrics.dti === null ? 'default' : metrics.dti <= 0.3 ? 'green' : metrics.dti <= 0.4 ? 'yellow' : 'red'}
          />
          <MetricCard
            label="อัตราการออม"
            value={metrics.savingsRate !== null ? fmtPct(metrics.savingsRate) : 'ไม่มีข้อมูล'}
            sub="เป้าหมาย 20%+"
            color={metrics.savingsRate === null ? 'default' : metrics.savingsRate >= 0.2 ? 'green' : metrics.savingsRate >= 0.1 ? 'yellow' : 'red'}
          />
          <MetricCard
            label="รายได้รวม/เดือน"
            value={fmtBaht(metrics.totalMonthlyIncome)}
          />
          <MetricCard
            label="คะแนนความรู้การลงทุน"
            value={`${(metrics.knowledgeScore * 6).toFixed(0)}/6 ข้อ`}
            color={metrics.knowledgeScore >= 0.67 ? 'green' : metrics.knowledgeScore >= 0.33 ? 'yellow' : 'red'}
          />
        </div>

        {/* Risk cards */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">การ์ดความเสี่ยง</h2>
        <div className="space-y-3 mb-8">
          {riskCards.map(card => <RiskCardComponent key={card.id} card={card} />)}
        </div>

        {/* Overall risk level */}
        <div className={`border rounded-xl p-5 mb-6 ${rl.color}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">ระดับความเสี่ยงโดยรวม</h2>
            <span className="text-xs font-medium">A = {riskResult.A.toFixed(2)}</span>
          </div>
          <p className="font-semibold text-lg mb-1">{rl.label}</p>
          <p className="text-sm mb-3">{rl.desc}</p>
          <div className="text-sm">
            <p className="font-medium mb-1">เหตุผลหลัก:</p>
            <ul className="list-disc list-inside space-y-1">
              {riskResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="mt-3 flex gap-4 text-xs">
            <span>Capacity Score: {riskResult.capacityScore.toFixed(0)}/100</span>
            <span>Tolerance Score: {riskResult.toleranceScore.toFixed(0)}/100</span>
            <span>Final Score: {riskResult.finalScore.toFixed(0)}/100</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/output2')}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 text-sm"
        >
          ดูว่าควรลงทุนแบบไหน →
        </button>

        <Disclaimer />
      </div>
    </div>
  )
}
