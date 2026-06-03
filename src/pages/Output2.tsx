import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useApp } from '../store/appStore'
import { broadAllocation } from '../engine/broadAllocation'
import { Disclaimer } from '../components/Disclaimer'
import { CMA } from '../engine/capitalMarketAssumptions'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f97316', '#94a3b8']

const LABELS: Record<string, string> = {
  thaiStocks: 'หุ้นไทย',
  foreignStocks: 'หุ้นต่างประเทศ',
  bonds: 'ตราสารหนี้',
  gold: 'ทองคำ',
  cash: 'เงินสด/พันธบัตรรัฐ',
}

export default function Output2() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const { riskResult, allocation } = state

  useEffect(() => {
    if (riskResult && !allocation) {
      const result = broadAllocation(riskResult.A)
      dispatch({ type: 'SET_ALLOCATION', payload: result })
    }
  }, [riskResult])

  if (!riskResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          เริ่มต้น
        </button>
      </div>
    )
  }

  const alloc = allocation || broadAllocation(riskResult.A)

  const pieData = Object.entries(alloc.weights)
    .filter(([, v]) => v > 0.001)
    .map(([key, value]) => ({ name: LABELS[key] || key, value: parseFloat((value * 100).toFixed(1)) }))

  const topAsset = pieData.sort((a, b) => b.value - a.value)[0]
  const cashPct = (alloc.weights.cash * 100).toFixed(0)

  const riskLevelLabel = { conservative: 'อนุรักษ์นิยม', moderate: 'สมดุล', aggressive: 'เชิงรุก' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button onClick={() => navigate('/output1')} className="text-indigo-600 text-sm mb-2 flex items-center gap-1">
            ← กลับ
          </button>
          <h1 className="text-2xl font-bold text-gray-900">ควรเป็นนักลงทุนแบบไหน</h1>
          <p className="text-sm text-gray-500">Output 2 — สัดส่วนสินทรัพย์ที่เหมาะสมกับคุณ</p>
        </div>

        {alloc.leverageFlag && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 mb-4 text-sm text-orange-700">
            ⚠️ จากค่าความเสี่ยงต่ำ สัดส่วนการลงทุนถูก clamp ไว้ที่ 100% (ไม่ใช้ leverage)
          </div>
        )}

        {/* Summary sentence */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <p className="text-indigo-900 text-sm leading-relaxed">
            ด้วยระดับความเสี่ยง<strong>{riskLevelLabel[riskResult.riskLevel]}</strong>ของคุณ (A = {riskResult.A.toFixed(1)})
            พอร์ตที่เหมาะคือเน้น<strong>{topAsset?.name}</strong> และกันเงินสด/พันธบัตรรัฐไว้ <strong>{cashPct}%</strong> เพื่อความมั่นคง
          </p>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">สัดส่วนสินทรัพย์</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รายละเอียดสัดส่วน</h2>
          <div className="space-y-2">
            {Object.entries(alloc.weights).map(([key, val], i) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div className="flex-1 text-sm text-gray-700">{LABELS[key] || key}</div>
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${val * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                </div>
                <div className="text-sm font-medium text-gray-900 w-12 text-right">{(val * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <p className="text-xs text-gray-500 mb-1">ผลตอบแทนคาดหวัง/ปี</p>
            <p className="text-2xl font-bold text-green-600">{(alloc.expectedReturn * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <p className="text-xs text-gray-500 mb-1">ความเสี่ยง (ส่วนเบี่ยงเบน)</p>
            <p className="text-2xl font-bold text-orange-500">{(alloc.expectedRisk * 100).toFixed(1)}%</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          ตัวเลขคำนวณจากสมมติฐานระยะยาว (Expected Return: หุ้นไทย {(CMA.assets.thaiStocks.expectedReturn*100).toFixed(0)}%, ต่างประเทศ {(CMA.assets.foreignStocks.expectedReturn*100).toFixed(0)}%, ตราสารหนี้ {(CMA.assets.bonds.expectedReturn*100).toFixed(0)}%, ทอง {(CMA.assets.gold.expectedReturn*100).toFixed(0)}%)
        </p>

        <button
          onClick={() => navigate('/output3')}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 text-sm"
        >
          ดูว่าควรซื้อตัวไหนบ้าง →
        </button>

        <Disclaimer />
      </div>
    </div>
  )
}
