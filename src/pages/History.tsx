import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { useAuth } from '../auth/AuthContext'
import { db } from '../db'
import type { CustomerRecord } from '../db'
import { exportMetricsCSV } from '../utils/exportCSV'
import { exportToPDF } from '../utils/exportPDF'

const riskBadge: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  moderate:     'bg-yellow-100 text-yellow-800',
  aggressive:   'bg-red-100 text-red-800',
}
const riskLabel: Record<string, string> = {
  conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fmtBaht(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' ล้าน ฿'
  return n.toLocaleString('th-TH') + ' ฿'
}

export default function History() {
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const { dispatch } = useApp()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    db.getCustomers().then(({ data }) => { setRecords(data); setLoading(false) })
  }, [])

  function loadRecord(r: CustomerRecord) {
    dispatch({ type: 'SET_ANSWERS',     payload: r.answers })
    dispatch({ type: 'SET_METRICS',     payload: r.metrics })
    dispatch({ type: 'SET_RISK_RESULT', payload: r.riskResult })
    dispatch({ type: 'SET_RISK_CARDS',  payload: r.riskCards })
    if (r.allocation) dispatch({ type: 'SET_ALLOCATION', payload: r.allocation })
    navigate('/output1')
  }

  async function handleExportCSV(r: CustomerRecord) {
    setExporting(r.id + '-csv')
    exportMetricsCSV(r.metrics, r.riskResult, r.riskCards, r.allocation, r.fullName)
    setExporting(null)
  }

  async function handleExportPDF(r: CustomerRecord) {
    setExporting(r.id + '-pdf')
    loadRecord(r)
    await new Promise(res => setTimeout(res, 800))
    await exportToPDF('output1-content', `assessment-${r.fullName}-${r.createdAt?.slice(0, 10)}.pdf`)
    setExporting(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบประวัติการประเมินนี้?')) return
    await db.deleteCustomer(id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ประวัติการประเมิน</h1>
            {user && <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              + ประเมินใหม่
            </button>
            {user && (
              <button onClick={() => { signOut(); navigate('/login') }}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                ออกจากระบบ
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">ยังไม่มีประวัติการประเมิน</p>
            <button onClick={() => navigate('/')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
              เริ่มประเมินเลย
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{r.fullName || 'ไม่ระบุชื่อ'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.createdAt ? fmtDate(r.createdAt) : '-'}
                      {r.age ? ` · อายุ ${r.age} ปี` : ''}
                      {r.occupation ? ` · ${r.occupation}` : ''}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskBadge[r.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                    {riskLabel[r.riskLevel] || r.riskLevel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">ค่า A</p>
                    <p className="font-bold text-gray-800">{r.riskA?.toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">ทรัพย์สินสุทธิ</p>
                    <p className={`font-bold text-sm ${r.netWorth >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.netWorth >= 0 ? '' : '-'}{fmtBaht(Math.abs(r.netWorth))}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">การ์ดแดง</p>
                    <p className="font-bold text-red-600">
                      {r.riskCards?.filter(c => c.level === 'red').length ?? 0} ใบ
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => loadRecord(r)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                    ดูผลลัพธ์
                  </button>
                  <button
                    onClick={() => handleExportCSV(r)}
                    disabled={exporting === r.id + '-csv'}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    {exporting === r.id + '-csv' ? '...' : '⬇ CSV'}
                  </button>
                  <button
                    onClick={() => handleExportPDF(r)}
                    disabled={exporting === r.id + '-pdf'}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    {exporting === r.id + '-pdf' ? '...' : '⬇ PDF'}
                  </button>
                  <button onClick={() => handleDelete(r.id!)}
                    className="px-3 py-1.5 text-red-400 hover:text-red-600 rounded-lg text-xs ml-auto">
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
