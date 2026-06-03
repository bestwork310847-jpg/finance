import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/appStore'
import { computeMetrics } from '../engine/metrics'
import { computeRiskCoefficient } from '../engine/riskCoefficient'
import { assessAllRisks } from '../engine/riskCards'
import type { Answers } from '../engine/types'

const TOTAL_STEPS = 11

const KNOWLEDGE_QUESTIONS = [
  {
    q: 'หุ้นกับพันธบัตรต่างกันอย่างไร?',
    options: ['ไม่แน่ใจ', 'หุ้นผันผวนและเสี่ยงสูงกว่า', 'พันธบัตรเสี่ยงกว่า', 'เหมือนกัน'],
  },
  {
    q: 'การ diversification (กระจายการลงทุน) เพื่ออะไร?',
    options: ['เพิ่มความเสี่ยง', 'ลดความเสี่ยงของพอร์ต', 'ทำกำไรระยะสั้น', 'ไม่แน่ใจ'],
  },
  {
    q: 'เมื่อดอกเบี้ยขึ้น สินทรัพย์ใดกระทบมากที่สุด?',
    options: ['พันธบัตร', 'เงินสด', 'ไม่แน่ใจ', 'ทุกสินทรัพย์เท่ากัน'],
  },
  {
    q: 'การลงทุนระยะยาวช่วยอะไร?',
    options: ['ลดผลกระทบจากความผันผวนระยะสั้น', 'การันตีกำไร', 'หลีกเลี่ยงความเสี่ยงทั้งหมด', 'ไม่แน่ใจ'],
  },
  {
    q: 'ETF คืออะไร?',
    options: ['กองทุนที่ซื้อขายในตลาดหุ้น', 'คริปโตเคอร์เรนซี', 'ตราสารหนี้รัฐบาล', 'ไม่แน่ใจ'],
  },
  {
    q: 'ถ้าไม่เข้าใจสินทรัพย์หนึ่ง ควรทำอย่างไร?',
    options: ['ศึกษาเพิ่มก่อนลงทุน', 'ลงทุนตามกระแส', 'ลงทุนทันที', 'หลีกเลี่ยงทุกอย่าง'],
  },
]

function emptyAnswers(): Partial<Answers> {
  return {
    fullName: '', age: 30, gender: 'ชาย', maritalStatus: 'โสด',
    children: 0, dependents: 0, province: '', retirementAge: 60,
    education: 'ตรี', occupation: 'พนักงานบริษัท', jobStability: 'ปานกลาง',
    hasChronicDisease: 'ไม่มี',
    mainIncome: 50000, annualBonus: 0, sideIncome: 0, passiveIncome: 0,
    incomeConsistency: 'ค่อนข้างสม่ำเสมอ', emergencyMonthsHeld: 3, layoffRisk: 'ปานกลาง',
    monthlyExpenses: 30000, monthlySavings: 10000,
    cashFlowProblems: 'ไม่เคย', creditCardOverspend: 'ไม่เคย',
    cash: 100000, bankDeposit: 200000, thaiStocksAsset: 0,
    foreignStocksAsset: 0, crypto: 0, goldAsset: 0, realEstate: 0,
    mortgageDebt: 0, carDebt: 0, creditCardDebt: 0, personalDebt: 0,
    totalMonthlyDebtPayment: 0, everDefaulted: 'ไม่เคย',
    hasLifeInsurance: 'ไม่มี', hasHealthInsurance: 'ไม่มี', hasCriticalIllnessInsurance: 'ไม่มี',
    hasInvestedBefore: 'ไม่เคย', portfolioDrop20Response: 'ถือไว้',
    mainDecisionFactor: 'วิเคราะห์เอง',
    knowledgeAnswers: ['', '', '', '', '', ''],
    portfolioDrop1Month: 'ถือไว้รอดู', marketCrashMonths: 'ลงเท่าเดิม',
    volatilityTolerance: 'รับได้บ้าง', investmentStyle: 'สมดุลเสี่ยง-ผลตอบแทน',
    mainGoal: 'เกษียณสุขสบาย', targetReturnPercent: 8, investmentHorizonYears: 10,
    annualSalary: 600000, investsSSF: 'ไม่ลงทุน', investsRMF: 'ไม่ลงทุน',
    monthlyExpenseAfterRetirement: 30000, currentRetirementSavings: 0, expectedLifespan: 80,
  }
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function NumberField({ label, value, onChange, min = 0, placeholder = '0' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; placeholder?: string
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={value || ''}
        min={min}
        placeholder={placeholder}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}

function TextField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}

export default function Questionnaire() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Partial<Answers>>(emptyAnswers())
  const { dispatch } = useApp()
  const navigate = useNavigate()

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setKnowledge(i: number, val: string) {
    const arr = [...(data.knowledgeAnswers || ['', '', '', '', '', ''])]
    arr[i] = val
    setData(prev => ({ ...prev, knowledgeAnswers: arr }))
  }

  function handleSubmit() {
    const answers = data as Answers
    const metrics = computeMetrics(answers)
    const riskResult = computeRiskCoefficient(metrics, answers)
    const riskCards = assessAllRisks(metrics, answers)
    dispatch({ type: 'SET_ANSWERS', payload: answers })
    dispatch({ type: 'SET_METRICS', payload: metrics })
    dispatch({ type: 'SET_RISK_RESULT', payload: riskResult })
    dispatch({ type: 'SET_RISK_CARDS', payload: riskCards })
    navigate('/output1')
  }

  const stepTitles = [
    'ข้อมูลส่วนบุคคล', 'รายได้และความมั่นคง', 'ค่าใช้จ่ายและกระแสเงินสด',
    'สินทรัพย์', 'หนี้สิน', 'ประกัน', 'ประสบการณ์ลงทุน',
    'แบบทดสอบความรู้', 'พฤติกรรมการลงทุน', 'เป้าหมายและภาษี', 'เกษียณ',
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-indigo-700 mb-1">ประเมินโปรไฟล์นักลงทุน</h1>
          <p className="text-sm text-gray-500">ขั้นตอน {step} / {TOTAL_STEPS} — {stepTitles[step - 1]}</p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-indigo-500 rounded-full transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {step === 1 && (
            <>
              <TextField label="ชื่อ-นามสกุล" value={data.fullName || ''} onChange={v => set('fullName', v)} />
              <NumberField label="อายุ (ปี)" value={data.age || 0} onChange={v => set('age', v)} min={1} />
              <SelectField label="เพศ" value={data.gender || 'ชาย'} options={['ชาย', 'หญิง', 'อื่นๆ']} onChange={v => set('gender', v as Answers['gender'])} />
              <SelectField label="สถานภาพสมรส" value={data.maritalStatus || 'โสด'} options={['โสด', 'แต่งงาน', 'หย่าร้าง', 'หม้าย']} onChange={v => set('maritalStatus', v as Answers['maritalStatus'])} />
              <NumberField label="จำนวนบุตร" value={data.children || 0} onChange={v => set('children', v)} />
              <NumberField label="จำนวนผู้พึ่งพิง (รวมบุตร)" value={data.dependents || 0} onChange={v => set('dependents', v)} />
              <TextField label="จังหวัดที่อาศัย" value={data.province || ''} onChange={v => set('province', v)} />
              <NumberField label="อายุที่ต้องการเกษียณ" value={data.retirementAge || 60} onChange={v => set('retirementAge', v)} min={1} />
              <SelectField label="ระดับการศึกษา" value={data.education || 'ตรี'} options={['ต่ำกว่ามัธยม', 'มัธยม', 'ปวช./ปวส.', 'ตรี', 'โท', 'เอก']} onChange={v => set('education', v)} />
              <SelectField label="อาชีพ" value={data.occupation || 'พนักงานบริษัท'} options={['ข้าราชการ', 'พนักงานบริษัท', 'เจ้าของธุรกิจ', 'ฟรีแลนซ์', 'นักลงทุน', 'เกษียณ']} onChange={v => set('occupation', v)} />
              <SelectField label="ความมั่นคงของอาชีพ" value={data.jobStability || 'ปานกลาง'} options={['สูง', 'ปานกลาง', 'ต่ำ']} onChange={v => set('jobStability', v as Answers['jobStability'])} />
              <SelectField label="มีโรคประจำตัว" value={data.hasChronicDisease || 'ไม่มี'} options={['ไม่มี', 'มี']} onChange={v => set('hasChronicDisease', v as Answers['hasChronicDisease'])} />
            </>
          )}

          {step === 2 && (
            <>
              <NumberField label="รายได้หลักต่อเดือน (บาท)" value={data.mainIncome || 0} onChange={v => set('mainIncome', v)} />
              <NumberField label="โบนัสต่อปี (บาท)" value={data.annualBonus || 0} onChange={v => set('annualBonus', v)} />
              <NumberField label="รายได้เสริมต่อเดือน (บาท)" value={data.sideIncome || 0} onChange={v => set('sideIncome', v)} />
              <NumberField label="Passive Income ต่อเดือน (บาท)" value={data.passiveIncome || 0} onChange={v => set('passiveIncome', v)} />
              <SelectField label="ความสม่ำเสมอของรายได้" value={data.incomeConsistency || 'ค่อนข้างสม่ำเสมอ'} options={['สม่ำเสมอมาก', 'ค่อนข้างสม่ำเสมอ', 'ผันผวน', 'ผันผวนสูง']} onChange={v => set('incomeConsistency', v as Answers['incomeConsistency'])} />
              <NumberField label="เงินสำรองฉุกเฉินที่มีอยู่เพียงพอกี่เดือน" value={data.emergencyMonthsHeld || 0} onChange={v => set('emergencyMonthsHeld', v)} />
              <SelectField label="โอกาสถูกเลิกจ้าง" value={data.layoffRisk || 'ปานกลาง'} options={['ต่ำ', 'ปานกลาง', 'สูง']} onChange={v => set('layoffRisk', v as Answers['layoffRisk'])} />
            </>
          )}

          {step === 3 && (
            <>
              <NumberField label="ค่าใช้จ่ายรวมต่อเดือน (บาท)" value={data.monthlyExpenses || 0} onChange={v => set('monthlyExpenses', v)} />
              <NumberField label="เงินออมต่อเดือน (บาท)" value={data.monthlySavings || 0} onChange={v => set('monthlySavings', v)} />
              <SelectField label="เคยมีปัญหาเงินไม่พอใช้ไหม" value={data.cashFlowProblems || 'ไม่เคย'} options={['ไม่เคย', 'บางครั้ง', 'บ่อย']} onChange={v => set('cashFlowProblems', v as Answers['cashFlowProblems'])} />
              <SelectField label="ใช้บัตรเครดิตเกินกำลังไหม" value={data.creditCardOverspend || 'ไม่เคย'} options={['ไม่เคย', 'บางครั้ง', 'บ่อย']} onChange={v => set('creditCardOverspend', v as Answers['creditCardOverspend'])} />
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-xs text-gray-400 mb-3">กรอกมูลค่าปัจจุบันเป็นบาท (ถ้าไม่มีใส่ 0)</p>
              <NumberField label="เงินสดในมือ (บาท)" value={data.cash || 0} onChange={v => set('cash', v)} />
              <NumberField label="เงินฝากธนาคาร (บาท)" value={data.bankDeposit || 0} onChange={v => set('bankDeposit', v)} />
              <NumberField label="หุ้นไทย (บาท)" value={data.thaiStocksAsset || 0} onChange={v => set('thaiStocksAsset', v)} />
              <NumberField label="หุ้นต่างประเทศ (บาท)" value={data.foreignStocksAsset || 0} onChange={v => set('foreignStocksAsset', v)} />
              <NumberField label="Crypto (บาท)" value={data.crypto || 0} onChange={v => set('crypto', v)} />
              <NumberField label="ทองคำ (บาท)" value={data.goldAsset || 0} onChange={v => set('goldAsset', v)} />
              <NumberField label="อสังหาริมทรัพย์ (บาท)" value={data.realEstate || 0} onChange={v => set('realEstate', v)} />
            </>
          )}

          {step === 5 && (
            <>
              <p className="text-xs text-gray-400 mb-3">กรอกยอดหนี้คงเหลือเป็นบาท (ถ้าไม่มีใส่ 0)</p>
              <NumberField label="หนี้บ้าน (บาท)" value={data.mortgageDebt || 0} onChange={v => set('mortgageDebt', v)} />
              <NumberField label="หนี้รถ (บาท)" value={data.carDebt || 0} onChange={v => set('carDebt', v)} />
              <NumberField label="หนี้บัตรเครดิต (บาท)" value={data.creditCardDebt || 0} onChange={v => set('creditCardDebt', v)} />
              <NumberField label="หนี้ส่วนบุคคล (บาท)" value={data.personalDebt || 0} onChange={v => set('personalDebt', v)} />
              <NumberField label="ค่างวดรวมต่อเดือน (บาท)" value={data.totalMonthlyDebtPayment || 0} onChange={v => set('totalMonthlyDebtPayment', v)} />
              <SelectField label="เคยผิดนัดชำระหนี้ไหม" value={data.everDefaulted || 'ไม่เคย'} options={['ไม่เคย', 'เคย']} onChange={v => set('everDefaulted', v as Answers['everDefaulted'])} />
            </>
          )}

          {step === 6 && (
            <>
              <SelectField label="มีประกันชีวิตไหม" value={data.hasLifeInsurance || 'ไม่มี'} options={['ไม่มี', 'มี']} onChange={v => set('hasLifeInsurance', v as Answers['hasLifeInsurance'])} />
              <SelectField label="มีประกันสุขภาพไหม" value={data.hasHealthInsurance || 'ไม่มี'} options={['ไม่มี', 'มี']} onChange={v => set('hasHealthInsurance', v as Answers['hasHealthInsurance'])} />
              <SelectField label="มีประกันโรคร้ายแรงไหม" value={data.hasCriticalIllnessInsurance || 'ไม่มี'} options={['ไม่มี', 'มี']} onChange={v => set('hasCriticalIllnessInsurance', v as Answers['hasCriticalIllnessInsurance'])} />
            </>
          )}

          {step === 7 && (
            <>
              <SelectField label="เคยลงทุนมาก่อนไหม" value={data.hasInvestedBefore || 'ไม่เคย'} options={['ไม่เคย', 'เคย']} onChange={v => set('hasInvestedBefore', v as Answers['hasInvestedBefore'])} />
              <SelectField label="ถ้าพอร์ตลดลง 20% คุณจะทำอะไร" value={data.portfolioDrop20Response || 'ถือไว้'} options={['ซื้อเพิ่มเพราะมองเป็นโอกาส', 'ถือไว้รอดู', 'เริ่มกังวล ลดบางส่วน', 'ขายทั้งหมดทันที']} onChange={v => {
                const map: Record<string, Answers['portfolioDrop20Response']> = {
                  'ซื้อเพิ่มเพราะมองเป็นโอกาส': 'ซื้อเพิ่ม', 'ถือไว้รอดู': 'ถือไว้',
                  'เริ่มกังวล ลดบางส่วน': 'ลดบางส่วน', 'ขายทั้งหมดทันที': 'ขายทั้งหมด',
                }
                set('portfolioDrop20Response', map[v] || 'ถือไว้')
              }} />
              <SelectField label="อะไรมีผลต่อการตัดสินใจลงทุนมากสุด" value={data.mainDecisionFactor || 'วิเคราะห์เอง'} options={['วิเคราะห์เอง', 'คำแนะนำผู้เชี่ยวชาญ', 'แนวโน้มตลาดและข่าว', 'กระแสโซเชียล']} onChange={v => set('mainDecisionFactor', v as Answers['mainDecisionFactor'])} />
            </>
          )}

          {step === 8 && (
            <>
              <p className="text-sm text-gray-600 mb-4">ทำแบบทดสอบความรู้การลงทุน 6 ข้อ (ไม่มีผลต่อคะแนน เพียงช่วยปรับผลการประเมิน)</p>
              {KNOWLEDGE_QUESTIONS.map((kq, i) => (
                <div key={i} className="mb-5">
                  <p className="text-sm font-medium text-gray-700 mb-2">{i + 1}. {kq.q}</p>
                  <div className="space-y-2">
                    {kq.options.map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`kq-${i}`}
                          value={opt}
                          checked={(data.knowledgeAnswers || [])[i] === opt}
                          onChange={() => setKnowledge(i, opt)}
                          className="text-indigo-600"
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {step === 9 && (
            <>
              <SelectField label="พอร์ตลดลง 20% ใน 1 เดือน คุณจะทำอะไร" value={data.portfolioDrop1Month || 'ถือไว้รอดู'} options={['ขายทั้งหมด', 'ขายบางส่วน', 'ถือไว้รอดู', 'ซื้อเพิ่ม']} onChange={v => set('portfolioDrop1Month', v as Answers['portfolioDrop1Month'])} />
              <SelectField label="ตลาดตกหนักต่อเนื่องหลายเดือน คุณจะทำอะไร" value={data.marketCrashMonths || 'ลงเท่าเดิม'} options={['หยุดลงทุน', 'ลดการลงทุน', 'ลงเท่าเดิม', 'เพิ่มการลงทุน']} onChange={v => set('marketCrashMonths', v as Answers['marketCrashMonths'])} />
              <SelectField label="รับความผันผวนได้แค่ไหน" value={data.volatilityTolerance || 'รับได้บ้าง'} options={['ขาดทุนเล็กน้อยก็เครียด', 'รับได้บ้าง', 'รับได้ค่อนข้างมาก', 'รับสูงได้']} onChange={v => set('volatilityTolerance', v as Answers['volatilityTolerance'])} />
              <SelectField label="สไตล์การลงทุนของคุณ" value={data.investmentStyle || 'สมดุลเสี่ยง-ผลตอบแทน'} options={['รักษาเงินต้น', 'สมดุลเสี่ยง-ผลตอบแทน', 'ต้องการผลตอบแทนสูง', 'ยอมเสี่ยงสูงมาก']} onChange={v => set('investmentStyle', v as Answers['investmentStyle'])} />
            </>
          )}

          {step === 10 && (
            <>
              <TextField label="เป้าหมายทางการเงินหลัก" value={data.mainGoal || ''} onChange={v => set('mainGoal', v)} />
              <NumberField label="เป้าหมายผลตอบแทนต่อปี (%)" value={data.targetReturnPercent || 0} onChange={v => set('targetReturnPercent', v)} />
              <NumberField label="ระยะเวลาการลงทุน (ปี)" value={data.investmentHorizonYears || 0} onChange={v => set('investmentHorizonYears', v)} />
              <NumberField label="เงินเดือนต่อปี (บาท)" value={data.annualSalary || 0} onChange={v => set('annualSalary', v)} />
              <SelectField label="ลงทุน SSF ไหม" value={data.investsSSF || 'ไม่ลงทุน'} options={['ไม่ลงทุน', 'ลงทุน']} onChange={v => set('investsSSF', v as Answers['investsSSF'])} />
              <SelectField label="ลงทุน RMF ไหม" value={data.investsRMF || 'ไม่ลงทุน'} options={['ไม่ลงทุน', 'ลงทุน']} onChange={v => set('investsRMF', v as Answers['investsRMF'])} />
            </>
          )}

          {step === 11 && (
            <>
              <NumberField label="ค่าใช้จ่ายหลังเกษียณต่อเดือน (บาท)" value={data.monthlyExpenseAfterRetirement || 0} onChange={v => set('monthlyExpenseAfterRetirement', v)} />
              <NumberField label="เงินเกษียณที่มีอยู่แล้ว (บาท)" value={data.currentRetirementSavings || 0} onChange={v => set('currentRetirementSavings', v)} />
              <NumberField label="คาดหวังอายุขัย (ปี)" value={data.expectedLifespan || 80} onChange={v => set('expectedLifespan', v)} min={1} />
            </>
          )}
        </div>

        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 text-sm"
            >
              ← ย้อนกลับ
            </button>
          ) : <div />}

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              ถัดไป →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              ดูผลการประเมิน →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
