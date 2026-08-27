import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import type { CustomerRecord } from '../db/dbTypes'
import { errorMessage, fromSupabaseError } from '../lib/errors'

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
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fmtBaht(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' ล้าน ฿'
  return n.toLocaleString('th-TH') + ' ฿'
}

export default function AdminUser() {
  const { userId } = useParams<{ userId: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = !!ADMIN_UID && user?.id === ADMIN_UID

  useEffect(() => {
    if (loading) return
    if (!isAdmin || !userId) { setFetching(false); return }
    if (!supabase) { setError(errorMessage('DB_NOT_CONFIGURED')); setFetching(false); return }
    supabase
      .from('assessments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(fromSupabaseError(err)!.message); setFetching(false); return }
        setRecords((data || []).map(mapRow))
        setFetching(false)
      })
  }, [loading, isAdmin, userId])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>

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

  const clientName = records[0]?.fullName || 'ลูกค้า'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button onClick={() => navigate('/admin')} className="text-indigo-600 text-sm mb-2">← กลับรายชื่อลูกค้า</button>
          <h1 className="text-2xl font-bold text-gray-900">แฟ้ม: {clientName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{records.length} การประเมิน</p>
        </div>

        {fetching ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">{error}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">ไม่พบการประเมิน</div>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {r.createdAt ? fmtDate(r.createdAt) : '-'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.age} ปี · {r.occupation} · {r.province}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskBadge[r.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                    {riskLabel[r.riskLevel] || r.riskLevel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-xs text-gray-400">ค่า A</p>
                    <p className="font-bold text-gray-800">{r.riskA?.toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-xs text-gray-400">ทรัพย์สินสุทธิ</p>
                    <p className={`font-bold text-sm ${r.netWorth >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmtBaht(r.netWorth)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-xs text-gray-400">การ์ดแดง</p>
                    <p className="font-bold text-red-600">
                      {r.riskCards?.filter(c => c.level === 'red').length ?? 0} ใบ
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/admin/${userId}/${r.id}`)}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  ดูผลเต็ม →
                </button>
              </div>
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
