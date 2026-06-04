import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, dbMode } from '../db'
import type { CustomerRecord } from '../db'
import { useApp } from '../store/appStore'

const riskBadge: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  moderate:     'bg-yellow-100 text-yellow-800',
  aggressive:   'bg-red-100 text-red-800',
}
const riskLabel: Record<string, string> = {
  conservative: 'Conservative',
  moderate:     'Moderate',
  aggressive:   'Aggressive',
}

function fmtBaht(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' ล้าน'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + ' พัน'
  return n.toFixed(0)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Admin() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const navigate = useNavigate()
  const { dispatch } = useApp()

  async function load() {
    setLoading(true)
    const { data, error } = await db.getCustomers()
    setCustomers(data)
    setError(error)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('ลบข้อมูลนี้?')) return
    setDeleting(id)
    await db.deleteCustomer(id)
    setDeleting(null)
    setCustomers(prev => prev.filter(c => c.id !== id))
  }

  function handleLoad(c: CustomerRecord) {
    // โหลดข้อมูลลูกค้ากลับเข้า app state เพื่อดูผล
    dispatch({ type: 'SET_ANSWERS',     payload: c.answers })
    dispatch({ type: 'SET_METRICS',     payload: c.metrics })
    dispatch({ type: 'SET_RISK_RESULT', payload: c.riskResult })
    dispatch({ type: 'SET_RISK_CARDS',  payload: c.riskCards })
    if (c.allocation) dispatch({ type: 'SET_ALLOCATION', payload: c.allocation })
    navigate('/output1')
  }

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.province?.toLowerCase().includes(search.toLowerCase()) ||
      c.occupation?.toLowerCase().includes(search.toLowerCase())
    const matchRisk = filterRisk === 'all' || c.riskLevel === filterRisk
    return matchSearch && matchRisk
  })

  const stats = {
    total: customers.length,
    conservative: customers.filter(c => c.riskLevel === 'conservative').length,
    moderate:     customers.filter(c => c.riskLevel === 'moderate').length,
    aggressive:   customers.filter(c => c.riskLevel === 'aggressive').length,
    avgA:         customers.length
      ? (customers.reduce((s, c) => s + c.riskA, 0) / customers.length).toFixed(1)
      : '-',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายชื่อลูกค้า</h1>
            <p className="text-xs text-gray-400 mt-1">
              เก็บข้อมูลใน: <span className="font-medium text-indigo-600">{dbMode === 'supabase' ? 'Supabase (Cloud)' : 'localStorage (เครื่องนี้เท่านั้น)'}</span>
              {dbMode === 'localStorage' && (
                <span className="ml-2 text-orange-500">— ตั้งค่า Supabase เพื่อเก็บ cloud</span>
              )}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            + เพิ่มลูกค้าใหม่
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'ทั้งหมด', value: stats.total, color: 'text-gray-900' },
            { label: 'Conservative', value: stats.conservative, color: 'text-blue-700' },
            { label: 'Moderate', value: stats.moderate, color: 'text-yellow-700' },
            { label: 'Aggressive', value: stats.aggressive, color: 'text-red-700' },
            { label: 'ค่า A เฉลี่ย', value: stats.avgA, color: 'text-indigo-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg p-3 border border-gray-200 text-center shadow-sm">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="ค้นหาชื่อ, จังหวัด, อาชีพ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="all">ทุกระดับความเสี่ยง</option>
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {customers.length === 0 ? 'ยังไม่มีข้อมูลลูกค้า' : 'ไม่พบข้อมูลที่ค้นหา'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['ชื่อ-นามสกุล', 'อายุ', 'อาชีพ', 'จังหวัด', 'ระดับเสี่ยง', 'ค่า A', 'ทรัพย์สินสุทธิ', 'วันที่', 'จัดการ'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.fullName || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.age} ปี</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.occupation || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.province || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskBadge[c.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                          {riskLabel[c.riskLevel] || c.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{c.riskA?.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <span className={c.netWorth >= 0 ? 'text-green-700' : 'text-red-600'}>
                          {c.netWorth >= 0 ? '' : '-'}{fmtBaht(Math.abs(c.netWorth))} ฿
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {c.createdAt ? fmtDate(c.createdAt) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoad(c)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                          >
                            ดูผล
                          </button>
                          <button
                            onClick={() => handleDelete(c.id!)}
                            disabled={deleting === c.id}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            {deleting === c.id ? '...' : 'ลบ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              แสดง {filtered.length} จาก {customers.length} รายการ
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
