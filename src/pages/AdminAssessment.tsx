import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import type { CustomerRecord } from '../db/dbTypes'
import { MetricCard } from '../components/MetricCard'
import { RiskCardComponent } from '../components/RiskCard'
import { Disclaimer } from '../components/Disclaimer'
import { exportToPDF } from '../utils/exportPDF'
import { exportMetricsCSV } from '../utils/exportCSV'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, ReferenceDot, Label,
} from 'recharts'
import { broadAllocation } from '../engine/broadAllocation'
import { efficientFrontier, tangencyPortfolio, optimalForPerson } from '../engine/optimizer'
import { afterTaxReturn } from '../engine/taxModule'
import { CMA } from '../engine/capitalMarketAssumptions'
import { THAI_TICKERS, FOREIGN_TICKERS, BOND_TICKERS, GOLD_TICKERS } from '../engine/dataLayer'

const ADMIN_UID = import.meta.env.VITE_ADMIN_USER_ID as string

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f97316', '#94a3b8']
const ASSET_LABELS: Record<string, string> = {
  thaiStocks: 'หุ้นไทย', foreignStocks: 'หุ้นต่างประเทศ', bonds: 'ตราสารหนี้', gold: 'ทองคำ', cash: 'เงินสด/พันธบัตรรัฐ',
}
const TICKER_SUGGESTIONS: Record<string, string[]> = {
  thaiStocks: THAI_TICKERS,
  foreignStocks: FOREIGN_TICKERS,
  bonds: BOND_TICKERS,
  gold: GOLD_TICKERS,
}
const FRONTIER_ASSETS = ['thaiStocks', 'foreignStocks', 'bonds', 'gold'] as const
function buildFrontierData() {
  const returns = FRONTIER_ASSETS.map(k => CMA.assets[k].expectedReturn)
  const n = FRONTIER_ASSETS.length
  const cov = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      CMA.correlations[i][j] * CMA.assets[FRONTIER_ASSETS[i]].volatility * CMA.assets[FRONTIER_ASSETS[j]].volatility
    )
  )
  return { returns, cov }
}
const riskLevelLabel: Record<string, { label: string; color: string; desc: string }> = {
  conservative: { label: 'Conservative — รักษาความมั่นคง', color: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'เหมาะกับการลงทุนที่เน้นความมั่นคงของเงินต้น ยอมรับผลตอบแทนน้อยแลกกับความเสี่ยงต่ำ' },
  moderate:      { label: 'Moderate — สมดุล', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', desc: 'รับความเสี่ยงได้ปานกลาง มุ่งสร้างผลตอบแทนสม่ำเสมอในระยะกลาง' },
  aggressive:    { label: 'Aggressive — เน้นเติบโต', color: 'bg-red-100 text-red-800 border-red-300', desc: 'รับความเสี่ยงสูงได้ มุ่งเน้นผลตอบแทนสูงในระยะยาว' },
}
function fmtBaht(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' ล้านบาท'
  return n.toLocaleString('th-TH') + ' บาท'
}
function fmtPct(n: number) { return (n * 100).toFixed(1) + '%' }
function fmtMonths(n: number) { return n.toFixed(1) + ' เดือน' }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminAssessment() {
  const { userId, assessmentId } = useParams<{ userId: string; assessmentId: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [record, setRecord] = useState<CustomerRecord | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [sliderA, setSliderA] = useState(4)

  const isAdmin = !!ADMIN_UID && user?.id === ADMIN_UID

  useEffect(() => {
    if (loading) return
    if (!isAdmin || !assessmentId) { setFetching(false); return }
    if (!supabase) { setError('Supabase ไม่ได้ตั้งค่า'); setFetching(false); return }
    supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError(err?.message ?? 'ไม่พบข้อมูล'); setFetching(false); return }
        const r = mapRow(data as Record<string, unknown>)
        setRecord(r)
        if (r.riskA) setSliderA(Math.min(8, Math.max(2, r.riskA)))
        setFetching(false)
      })
  }, [loading, isAdmin, assessmentId])

  if (loading || fetching) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-gray-700 font-medium mb-4">คุณไม่มีสิทธิ์เข้าถึง</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">กลับหน้าหลัก</button>
        </div>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'ไม่พบข้อมูล'}</p>
          <button onClick={() => navigate(`/admin/${userId}`)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">← กลับ</button>
        </div>
      </div>
    )
  }

  const { metrics, riskResult, riskCards } = record
  const alloc = record.allocation || (riskResult ? broadAllocation(riskResult.A) : null)
  const rl = riskLevelLabel[riskResult?.riskLevel ?? 'moderate']

  const pieData = alloc
    ? Object.entries(alloc.weights)
        .filter(([, v]) => v > 0.001)
        .map(([k, v]) => ({ name: ASSET_LABELS[k] || k, value: parseFloat((v * 100).toFixed(1)) }))
    : []

  // Optimizer — same computation as Output3, seeded with saved A value
  const { returns, cov } = useMemo(() => buildFrontierData(), [])
  const Rf = CMA.riskFreeRate
  const frontier = useMemo(() => efficientFrontier(returns, cov, 40), [])
  const tangency = useMemo(() => tangencyPortfolio(returns, cov, Rf), [])
  const optimal = useMemo(() => optimalForPerson(tangency, Rf, sliderA), [sliderA, tangency])

  const calPoints = useMemo(() => {
    const pts = []
    for (let y = 0; y <= 1.2; y += 0.05) {
      pts.push({ sigma: tangency.sigma * y * 100, mu: (Rf + (tangency.E - Rf) * y) * 100 })
    }
    return pts
  }, [tangency])

  const U = optimal.E - 0.5 * sliderA * optimal.sigma * optimal.sigma
  const indiffCurve = useMemo(() => {
    const pts = []
    for (let s = 0.01; s <= 0.30; s += 0.005) {
      const mu = U + 0.5 * sliderA * s * s
      if (mu > 0 && mu < 0.25) pts.push({ sigma: s * 100, mu: mu * 100 })
    }
    return pts
  }, [U, sliderA])

  // Tax — uses saved answers
  const taxResult = useMemo(() => {
    const answers = record.answers
    const taxInput = {
      thaiStocksDividend: (optimal.finalWeights[0] || 0) * 1_000_000 * 0.025,
      foreignStocksDividend: (optimal.finalWeights[1] || 0) * 1_000_000 * 0.015,
      foreignStocksGain: (optimal.finalWeights[1] || 0) * 1_000_000 * (CMA.assets.foreignStocks.expectedReturn - 0.015),
      bondInterest: (optimal.finalWeights[2] || 0) * 1_000_000 * CMA.assets.bonds.expectedReturn,
      ssfAmount: answers?.investsSSF === 'ลงทุน' ? 50000 : 0,
      rmfAmount: answers?.investsRMF === 'ลงทุน' ? 50000 : 0,
    }
    const taxPerson = {
      annualIncome: answers?.annualSalary || 600000,
      daysInThailand: 200,
      remitForeignGains: false,
      existingDeductions: 0,
    }
    return afterTaxReturn(taxInput, taxPerson)
  }, [sliderA, record.answers])

  async function handleExportPDF() {
    setExporting(true)
    await exportToPDF('admin-assessment-content', `assessment-${record!.fullName}-${record!.createdAt?.slice(0, 10)}.pdf`)
    setExporting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate(`/admin/${userId}`)} className="text-indigo-600 text-sm mb-2">← กลับแฟ้มลูกค้า</button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{record.fullName}</h1>
              <p className="text-sm text-gray-500">
                ประเมินเมื่อ {record.createdAt ? fmtDate(record.createdAt) : '-'}
                {record.age ? ` · ${record.age} ปี` : ''}
                {record.occupation ? ` · ${record.occupation}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportMetricsCSV(metrics, riskResult!, riskCards, alloc, record.fullName)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
              >
                ⬇ CSV
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded-lg text-xs hover:bg-indigo-50 disabled:opacity-50"
              >
                {exporting ? 'กำลัง export...' : '⬇ PDF'}
              </button>
            </div>
          </div>
        </div>

        <div id="admin-assessment-content">

          {/* Metric cards — same as Output1 */}
          {metrics && (
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
              <MetricCard label="รายได้รวม/เดือน" value={fmtBaht(metrics.totalMonthlyIncome)} />
              <MetricCard
                label="คะแนนความรู้การลงทุน"
                value={`${(metrics.knowledgeScore * 6).toFixed(0)}/6 ข้อ`}
                color={metrics.knowledgeScore >= 0.67 ? 'green' : metrics.knowledgeScore >= 0.33 ? 'yellow' : 'red'}
              />
            </div>
          )}

          {/* Risk cards — same as Output1 */}
          {riskCards?.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">การ์ดความเสี่ยง</h2>
              <div className="space-y-3 mb-8">
                {riskCards.map(card => <RiskCardComponent key={card.id} card={card} />)}
              </div>
            </>
          )}

          {/* Overall risk level — same as Output1 */}
          {riskResult && (
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
          )}

          {/* Asset allocation — same as Output2 */}
          {alloc && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">สัดส่วนสินทรัพย์ที่แนะนำ</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">ผลตอบแทนคาดหวัง/ปี</p>
                  <p className="font-bold text-green-600">{(alloc.expectedReturn * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">ความเสี่ยง σ</p>
                  <p className="font-bold text-orange-500">{(alloc.expectedRisk * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Tangency asset list — same as Output3 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">สินทรัพย์แนะนำ (Tangency Portfolio)</h2>
            <div className="space-y-3">
              {FRONTIER_ASSETS.map((asset, i) => {
                const w = optimal.finalWeights[i] || 0
                const tickers = TICKER_SUGGESTIONS[asset] || []
                return (
                  <div key={asset} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-gray-800">{ASSET_LABELS[asset]}</span>
                      <span className="text-indigo-700 font-bold text-sm">{(w * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                      <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${w * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-400">ตัวอย่าง: {tickers.join(', ')}</p>
                  </div>
                )
              })}
              <div className="border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm text-gray-800">เงินสด/พันธบัตรรัฐ</span>
                  <span className="text-gray-600 font-bold text-sm">{(optimal.ySafe * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            {optimal.leverageFlag && (
              <p className="text-xs text-orange-500 mt-2">⚠️ Leverage clamped — ลงทุนได้สูงสุด 100% ของเงินต้น</p>
            )}
          </div>

          {/* Efficient frontier — same as Output3 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Efficient Frontier & จุดที่เหมาะกับลูกค้า</h2>
            <p className="text-xs text-gray-400 mb-3">
              จุดสีเขียว = Tangency | จุดสีส้ม = จุดของลูกค้า (ขึ้นกับ A)
            </p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-500">A = {sliderA.toFixed(1)}</span>
              <input
                type="range" min={2} max={8} step={0.1}
                value={sliderA}
                onChange={e => setSliderA(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-xs text-gray-400">เสี่ยงน้อย ↔ เสี่ยงมาก</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <XAxis dataKey="sigma" type="number" domain={[0, 25]} label={{ value: 'ความเสี่ยง σ (%)', position: 'insideBottom', offset: -10 }} tick={{ fontSize: 11 }} />
                <YAxis dataKey="mu" type="number" domain={[0, 15]} label={{ value: 'ผลตอบแทน (%)', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Line data={frontier.map(p => ({ sigma: p.sigma * 100, mu: p.mu * 100 }))}
                  type="monotone" dataKey="mu" dot={false} stroke="#9ca3af" strokeWidth={2} name="Efficient Frontier" />
                <Line data={calPoints} type="linear" dataKey="mu" dot={false} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="CAL" />
                <Line data={indiffCurve} type="monotone" dataKey="mu" dot={false} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" name="Indifference" />
                <ReferenceDot x={tangency.sigma * 100} y={tangency.E * 100} r={6} fill="#22c55e" stroke="#16a34a" strokeWidth={2}>
                  <Label value="T" position="top" fontSize={11} fill="#16a34a" />
                </ReferenceDot>
                <ReferenceDot x={optimal.sigma * 100} y={optimal.E * 100} r={8} fill="#f97316" stroke="#ea580c" strokeWidth={2}>
                  <Label value="ลูกค้า" position="top" fontSize={11} fill="#ea580c" />
                </ReferenceDot>
              </LineChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: 'พอร์ตเสี่ยง', value: `${(optimal.yRisky * 100).toFixed(0)}%` },
                { label: 'เงินสด/พันธบัตร', value: `${(optimal.ySafe * 100).toFixed(0)}%` },
                { label: 'ผลตอบแทนคาดหวัง', value: `${(optimal.E * 100).toFixed(1)}%` },
                { label: 'ความเสี่ยง σ', value: `${(optimal.sigma * 100).toFixed(1)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-sm text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tax module — same as Output3 */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">ผลตอบแทนก่อน vs หลังภาษี (ประมาณการ ฐาน 1 ล้านบาท)</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">ก่อนภาษี</p>
                <p className="text-xl font-bold text-green-600">{taxResult.grossReturn.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">หลังภาษี</p>
                <p className="text-xl font-bold text-indigo-600">{taxResult.afterTaxReturn.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1 border-t pt-2">
              <div className="flex justify-between"><span>ภาษีปันผลหุ้นไทย</span><span>-{taxResult.taxOnThaiDividends.toFixed(0)} บาท</span></div>
              <div className="flex justify-between"><span>ภาษีปันผลหุ้นต่างประเทศ</span><span>-{taxResult.taxOnForeignDividends.toFixed(0)} บาท</span></div>
              {taxResult.ssfTaxSaving > 0 && <div className="flex justify-between text-green-600"><span>ประหยัดภาษีจาก SSF</span><span>+{taxResult.ssfTaxSaving.toFixed(0)} บาท</span></div>}
              {taxResult.rmfTaxSaving > 0 && <div className="flex justify-between text-green-600"><span>ประหยัดภาษีจาก RMF</span><span>+{taxResult.rmfTaxSaving.toFixed(0)} บาท</span></div>}
            </div>
            <p className="text-xs text-orange-500 mt-2">{taxResult.disclaimer}</p>
          </div>

        </div>{/* end admin-assessment-content */}

        <Disclaimer />
      </div>
    </div>
  )
}

function mapRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id:         row.id as string,
    createdAt:  row.created_at as string,
    userId:     row.user_id as string,
    fullName:   (row.full_name as string) || '',
    age:        (row.age as number) || 0,
    occupation: (row.occupation as string) || '',
    province:   (row.province as string) || '',
    riskLevel:  (row.risk_level as CustomerRecord['riskLevel']) || 'moderate',
    riskA:      (row.risk_a as number) || 0,
    netWorth:   (row.net_worth as number) || 0,
    answers:    row.answers as CustomerRecord['answers'],
    metrics:    row.metrics as CustomerRecord['metrics'],
    riskResult: row.risk_result as CustomerRecord['riskResult'],
    riskCards:  (row.risk_cards as CustomerRecord['riskCards']) || [],
    allocation: (row.allocation as CustomerRecord['allocation']) || null,
  }
}
