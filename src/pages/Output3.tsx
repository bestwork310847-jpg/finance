import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, Label
} from 'recharts'
import { useApp } from '../store/appStore'
import { Disclaimer } from '../components/Disclaimer'
import { efficientFrontier, tangencyPortfolio, optimalForPerson } from '../engine/optimizer'
import { afterTaxReturn } from '../engine/taxModule'
import { CMA } from '../engine/capitalMarketAssumptions'
import { THAI_TICKERS, FOREIGN_TICKERS, BOND_TICKERS, GOLD_TICKERS } from '../engine/dataLayer'

// Build mock returns/cov from CMA for display
function buildMockReturnsCov() {
  const assets = ['thaiStocks', 'foreignStocks', 'bonds', 'gold'] as const
  const returns = assets.map(k => CMA.assets[k].expectedReturn)
  const n = assets.length
  const cov = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      CMA.correlations[i][j] * CMA.assets[assets[i]].volatility * CMA.assets[assets[j]].volatility
    )
  )
  return { returns, cov, assetNames: assets }
}

const ASSET_LABELS: Record<string, string> = {
  thaiStocks: 'หุ้นไทย', foreignStocks: 'หุ้นต่างประเทศ', bonds: 'ตราสารหนี้', gold: 'ทองคำ'
}

const TICKER_SUGGESTIONS: Record<string, string[]> = {
  thaiStocks: THAI_TICKERS,
  foreignStocks: FOREIGN_TICKERS,
  bonds: BOND_TICKERS,
  gold: GOLD_TICKERS,
}

export default function Output3() {
  const { state } = useApp()
  const navigate = useNavigate()
  const { riskResult } = state
  const [sliderA, setSliderA] = useState<number>(riskResult?.A ?? 4)

  const { returns, cov, assetNames } = useMemo(() => buildMockReturnsCov(), [])
  const Rf = CMA.riskFreeRate

  const frontier = useMemo(() => efficientFrontier(returns, cov, 40), [])
  const tangency = useMemo(() => tangencyPortfolio(returns, cov, Rf), [])
  const optimal = useMemo(() => optimalForPerson(tangency, Rf, sliderA), [sliderA, tangency])

  // CAL line points
  const calPoints = useMemo(() => {
    const pts = []
    for (let y = 0; y <= 1.2; y += 0.05) {
      pts.push({ sigma: tangency.sigma * y * 100, mu: (Rf + (tangency.E - Rf) * y) * 100 })
    }
    return pts
  }, [tangency])

  // Indifference curve U = E - 0.5*A*sigma^2
  const U = optimal.E - 0.5 * sliderA * optimal.sigma * optimal.sigma
  const indiffCurve = useMemo(() => {
    const pts = []
    for (let s = 0.01; s <= 0.30; s += 0.005) {
      const mu = U + 0.5 * sliderA * s * s
      if (mu > 0 && mu < 0.25) pts.push({ sigma: s * 100, mu: mu * 100 })
    }
    return pts
  }, [U, sliderA])

  // Tax estimate
  const taxInput = {
    thaiStocksDividend: (optimal.finalWeights[0] || 0) * 1_000_000 * 0.025,
    foreignStocksDividend: (optimal.finalWeights[1] || 0) * 1_000_000 * 0.015,
    foreignStocksGain: (optimal.finalWeights[1] || 0) * 1_000_000 * (CMA.assets.foreignStocks.expectedReturn - 0.015),
    bondInterest: (optimal.finalWeights[2] || 0) * 1_000_000 * CMA.assets.bonds.expectedReturn,
    ssfAmount: state.answers?.investsSSF === 'ลงทุน' ? 50000 : 0,
    rmfAmount: state.answers?.investsRMF === 'ลงทุน' ? 50000 : 0,
  }
  const taxPerson = {
    annualIncome: state.answers?.annualSalary || 600000,
    daysInThailand: 200,
    remitForeignGains: false,
    existingDeductions: 0,
  }
  const taxResult = useMemo(() => afterTaxReturn(taxInput, taxPerson), [sliderA])

  if (!riskResult) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          เริ่มต้น
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button onClick={() => navigate('/output2')} className="text-indigo-600 text-sm mb-2">← กลับ</button>
          <h1 className="text-2xl font-bold text-gray-900">ซื้ออะไรเจาะจง</h1>
          <p className="text-sm text-gray-500">Output 3 — พอร์ตเฉพาะบุคคล + กราฟ efficient frontier</p>
        </div>

        {/* Asset list */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">สินทรัพย์แนะนำ (Tangency Portfolio)</h2>
          <div className="space-y-3">
            {assetNames.map((asset, i) => {
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

        {/* Interactive efficient frontier chart */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Efficient Frontier & จุดที่เหมาะกับคุณ</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            จุดสีเขียว = Tangency (ดีที่สุดสำหรับทุกคน) | จุดสีส้ม = จุดของคุณ (ขึ้นกับ A)
          </p>

          {/* A slider */}
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

              {/* Efficient frontier */}
              <Line
                data={frontier.map(p => ({ sigma: p.sigma * 100, mu: p.mu * 100 }))}
                type="monotone" dataKey="mu" dot={false} stroke="#9ca3af" strokeWidth={2} name="Efficient Frontier"
              />

              {/* CAL */}
              <Line
                data={calPoints}
                type="linear" dataKey="mu" dot={false} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="CAL"
              />

              {/* Indifference curve */}
              <Line
                data={indiffCurve}
                type="monotone" dataKey="mu" dot={false} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" name="Indifference"
              />

              {/* Tangency point */}
              <ReferenceDot x={tangency.sigma * 100} y={tangency.E * 100} r={6} fill="#22c55e" stroke="#16a34a" strokeWidth={2}>
                <Label value="T" position="top" fontSize={11} fill="#16a34a" />
              </ReferenceDot>

              {/* User's optimal point */}
              <ReferenceDot x={optimal.sigma * 100} y={optimal.E * 100} r={8} fill="#f97316" stroke="#ea580c" strokeWidth={2}>
                <Label value="คุณ" position="top" fontSize={11} fill="#ea580c" />
              </ReferenceDot>
            </LineChart>
          </ResponsiveContainer>

          {/* Stats box */}
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

        {/* Tax module */}
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

        <button
          onClick={() => alert('ฟีเจอร์ export จะพัฒนาในเวอร์ชันถัดไป')}
          className="w-full py-3 border border-indigo-600 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 text-sm mb-3"
        >
          บันทึก / Export แผน
        </button>

        <Disclaimer />
      </div>
    </div>
  )
}
