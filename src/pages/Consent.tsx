import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const CONSENT_KEY = 'pdpa_consent_given'

export function hasConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'true'
}

export default function Consent() {
  const [checked, setChecked] = useState(false)
  const navigate = useNavigate()

  function handleAccept() {
    if (!checked) return
    localStorage.setItem(CONSENT_KEY, 'true')
    navigate('/')
  }

  function handleDecline() {
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">ขอความยินยอมเก็บข้อมูล</h1>
          <p className="text-sm text-gray-500 mt-1">ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-3 mb-6 max-h-64 overflow-y-auto">
          <p className="font-semibold text-gray-800">ข้อมูลที่เราเก็บ</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>ข้อมูลส่วนบุคคล: ชื่อ อายุ อาชีพ จังหวัด</li>
            <li>ข้อมูลทางการเงิน: รายได้ ทรัพย์สิน หนี้สิน (ประมาณการ)</li>
            <li>ผลการประเมินความเสี่ยงและพอร์ตที่แนะนำ</li>
            <li>คำตอบแบบสอบถามทั้งหมด</li>
          </ul>

          <p className="font-semibold text-gray-800 mt-3">วัตถุประสงค์</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>เพื่อวิเคราะห์และแสดงผลการประเมินความเสี่ยงการลงทุน</li>
            <li>เพื่อเก็บประวัติการประเมินให้คุณกลับมาดูได้</li>
            <li>ไม่นำข้อมูลไปขายหรือแชร์กับบุคคลที่สาม</li>
          </ul>

          <p className="font-semibold text-gray-800 mt-3">สิทธิ์ของคุณ</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>ขอดู แก้ไข หรือลบข้อมูลได้ตลอดเวลา</li>
            <li>ถอนความยินยอมได้โดยการลบบัญชี</li>
            <li>ข้อมูลเก็บใน Supabase (Singapore) มีการเข้ารหัส</li>
          </ul>

          <p className="font-semibold text-gray-800 mt-3">ข้อสงวน</p>
          <p className="text-xs text-orange-600">
            ระบบนี้เป็นเครื่องมือประเมินเบื้องต้นเพื่อการศึกษาเท่านั้น
            ไม่ใช่คำแนะนำการลงทุนที่ได้รับอนุญาตจาก ก.ล.ต.
            กรุณาปรึกษาที่ปรึกษาทางการเงินที่มีใบอนุญาตก่อนตัดสินใจลงทุน
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm text-gray-700">
            ฉันอ่านและเข้าใจนโยบายข้างต้น และยินยอมให้เก็บข้อมูลการเงินส่วนบุคคลเพื่อวัตถุประสงค์ที่ระบุ
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            ไม่ยินยอม
          </button>
          <button
            onClick={handleAccept}
            disabled={!checked}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            ยินยอมและเริ่มใช้งาน
          </button>
        </div>
      </div>
    </div>
  )
}