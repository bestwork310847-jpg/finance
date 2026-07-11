import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import type { CustomerRecord } from '../db/dbTypes'

const ADMIN_UID = import.meta.env.VITE_ADMIN_USER_ID as string

const riskBadge: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-700',
  moderate:     'bg-yellow-100 text-yellow-700',
  aggressive:   'bg-red-100 text-red-700',
}
const riskLabel: Record<string, string> = {
  conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface UserFolder {
  userId: string
  latestName: string
  count: number
  latestDate: string
  latestRisk: CustomerRecord['riskLevel']
}

function buildFolders(records: CustomerRecord[]): UserFolder[] {
  const map = new Map<string, CustomerRecord[]>()
  records.forEach(r => {
    if (!r.userId) return
    if (!map.has(r.userId)) map.set(r.userId, [])
    map.get(r.userId)!.push(r)
  })
  return Array.from(map.entries()).map(([userId, items]) => {
    const sorted = [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    return {
      userId,
      latestName: sorted[0].fullName || 'ไม่ระบุชื่อ',
      count: items.length,
      latestDate: sorted[0].createdAt ?? '',
      latestRisk: sorted[0].riskLevel,
    }
  }).sort((a, b) => b.latestDate.localeCompare(a.latestDate))
}

function exportAllCSV(records: CustomerRecord[]) {
  const lines = [
    '﻿' + 'วันที่,ชื่อ,อายุ,อาชีพ,จังหวัด,ระดับความเสี่ยง,ค่า A,ทรัพย์สินสุทธิ',
    ...records.map(r => [
      r.createdAt ? fmtDate(r.createdAt) : '-',
      r.fullName,
      r.age,
      r.occupation,
      r.province,
      riskLabel[r.riskLevel] || r.riskLevel,
      r.riskA?.toFixed(2),
      r.netWorth,
    ].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'customers-all.csv'
  a.click()
}

export default function Admin() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const isAdmin = !!ADMIN_UID && user?.id === ADMIN_UID

  useEffect(() => {
    if (loading) return
    if (!isAdmin) { setFetching(false); return }
    if (!supabase) { setError('Supabase ไม่ได้ตั้งค่า'); setFetching(false); return }
    supabase
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setFetching(false); return }
        setRecords((data || []).map(mapRow))
        setFetching(false)
      })
  }, [loading, isAdmin])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-gray-700 font-medium mb-1">คุณไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-sm text-gray-400 mb-4">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">กลับหน้าหลัก</button>
        </div>
      </div>
    )
  }

  const folders = buildFolders(records)
  const filtered = folders.filter(f =>
    !search || f.latestName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แผงแอดมิน</h1>
            <p className="text-xs text-gray-400 mt-0.5">ลูกค้าทั้งหมด {folders.length} บัญชี · {records.length} การประเมิน</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportAllCSV(records)}
              className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              ⬇ Export CSV
            </button>
            <button onClick={() => navigate('/')}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              หน้าหลัก
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="ค้นหาตามชื่อลูกค้า..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'ลูกค้าทั้งหมด', value: folders.length, color: 'text-gray-900' },
            { label: 'การประเมินทั้งหมด', value: records.length, color: 'text-indigo-700' },
            { label: 'ค่า A เฉลี่ย', value: records.length ? (records.reduce((s, r) => s + (r.riskA || 0), 0) / records.length).toFixed(1) : '-', color: 'text-orange-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {fetching ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => (
              <button
                key={f.userId}
                onClick={() => navigate(`/admin/${f.userId}`)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base flex-shrink-0">
                  {f.latestName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{f.latestName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {f.count} การประเมิน · ล่าสุด {f.latestDate ? fmtDate(f.latestDate) : '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskBadge[f.latestRisk] || 'bg-gray-100 text-gray-600'}`}>
                    {riskLabel[f.latestRisk] || f.latestRisk}
                  </span>
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </button>
            ))}
          </div>
        )}
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
