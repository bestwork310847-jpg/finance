import type { Answers, MetricsResult, RiskCard } from './types'

// ---- THRESHOLDS ----
const T = {
  emergencyRed: 3,
  emergencyYellow: 6,
  dtiRed: 0.40,
  dtiYellow: 0.30,
  concentrationWarn: 0.50,
  savingsRateGood: 0.20,
  retirementGapFallback: 300, // fallback months when lifeExpectancy/retirementAge not usable
}

function fmt(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 1 })
}
function fmtBaht(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' บาท'
}
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

export function assessAllRisks(metrics: MetricsResult, a: Answers): RiskCard[] {
  const cards: RiskCard[] = []

  // 1. Income stability
  const incStab = a.jobStability === 'สูง' ? 'green' :
    a.jobStability === 'ปานกลาง' ? 'yellow' : 'red'
  cards.push({
    id: 'income-stability',
    name: 'ความมั่นคงของรายได้',
    level: incStab,
    punchline: incStab === 'green'
      ? `รายได้ ${fmtBaht(metrics.totalMonthlyIncome)}/เดือน มั่นคงดี เป็นฐานที่ดีในการลงทุน`
      : `รายได้ ${fmtBaht(metrics.totalMonthlyIncome)}/เดือน แต่ความมั่นคงอยู่ระดับ${a.jobStability} ถ้าขาดรายได้กะทันหันจะกระทบแผนการลงทุน`,
    advice: incStab === 'green'
      ? 'รักษาความมั่นคงนี้ไว้ และสร้าง passive income เพิ่มเติมต่อไป'
      : 'พิจารณาสร้างรายได้เสริมหรือ passive income เพื่อลดการพึ่งพารายได้เดียว',
  })

  // 2. Income consistency
  const consMap: Record<string, 'green' | 'yellow' | 'red'> = {
    'สม่ำเสมอมาก': 'green', 'ค่อนข้างสม่ำเสมอ': 'yellow',
    'ผันผวน': 'yellow', 'ผันผวนสูง': 'red',
  }
  const consLevel = consMap[a.incomeConsistency] ?? 'yellow'
  cards.push({
    id: 'income-consistency',
    name: 'ความสม่ำเสมอของรายได้',
    level: consLevel,
    punchline: consLevel === 'red'
      ? `รายได้ผันผวนสูง หมายความว่าถ้าตลาดร่วงพอดีกับเดือนที่รายได้ตกต่ำ คุณอาจถูกบังคับขายหุ้นตอนราคาต่ำสุด`
      : consLevel === 'yellow'
      ? `รายได้ค่อนข้างผันผวน ควรมีเงินสำรองมากกว่าปกติเพื่อหลีกเลี่ยงการบังคับขาย`
      : 'รายได้สม่ำเสมอดีมาก ช่วยให้วางแผนการลงทุนได้มีระเบียบ',
    advice: consLevel !== 'green'
      ? 'เก็บเงินสำรองฉุกเฉินให้ครบ 6+ เดือน ก่อนเพิ่มการลงทุนในสินทรัพย์ผันผวน'
      : 'ใช้ประโยชน์จากรายได้สม่ำเสมอด้วยการลงทุนแบบ DCA ทุกเดือน',
  })

  // 3. Liquidity
  const em = metrics.emergencyMonths
  const liqLevel: 'green' | 'yellow' | 'red' =
    em === null ? 'red' : em < T.emergencyRed ? 'red' : em < T.emergencyYellow ? 'yellow' : 'green'
  cards.push({
    id: 'liquidity',
    name: 'สภาพคล่อง / เงินสำรองฉุกเฉิน',
    level: liqLevel,
    punchline: em !== null
      ? liqLevel === 'green'
        ? `เงินสำรองฉุกเฉินของคุณอยู่ที่ ${fmt(em)} เดือน ถือว่าปลอดภัยดี`
        : `ถ้าพรุ่งนี้ขาดรายได้กะทันหัน เงินที่มีพยุงได้แค่ ${fmt(em)} เดือน ก่อนต้องเริ่มขายของลงทุน`
      : 'ไม่มีข้อมูลค่าใช้จ่ายรายเดือน ไม่สามารถคำนวณเงินสำรองได้',
    advice: liqLevel !== 'green'
      ? `เป้าหมาย: สะสมเงินสำรอง ${T.emergencyYellow} เดือนก่อน ≈ ${fmtBaht((a.monthlyExpenses || 0) * T.emergencyYellow)}`
      : 'เยี่ยม! พิจารณานำเงินส่วนเกินจาก 12 เดือนไปลงทุนเพิ่มได้',
  })

  // 4. Debt
  const dtiVal = metrics.dti
  const debtLevel: 'green' | 'yellow' | 'red' =
    dtiVal === null ? 'yellow' :
    dtiVal > T.dtiRed || a.everDefaulted === 'เคย' ? 'red' :
    dtiVal > T.dtiYellow ? 'yellow' : 'green'
  cards.push({
    id: 'debt',
    name: 'ภาระหนี้สิน',
    level: debtLevel,
    punchline: dtiVal !== null
      ? debtLevel === 'green'
        ? `ภาระหนี้คิดเป็น ${fmtPct(dtiVal)} ของรายได้ อยู่ในระดับที่จัดการได้ดี`
        : `ภาระหนี้คิดเป็น ${fmtPct(dtiVal)} ของรายได้ ${dtiVal > T.dtiRed ? 'สูงเกิน 40% เงินที่เหลือลงทุนน้อยมาก' : 'เริ่มสูง ควรระวัง'}`
      : 'ไม่มีข้อมูลรายได้หรือภาระหนี้',
    advice: debtLevel !== 'green'
      ? 'โฟกัสที่การลดหนี้ดอกเบี้ยสูง (บัตรเครดิต) ก่อน จากนั้นค่อยเพิ่มการออม'
      : 'ภาระหนี้อยู่ในระดับดี รักษาวินัยการชำระหนี้ไว้',
  })

  // 5. Market risk (risky asset ratio)
  const totalA = metrics.totalAssets || 1
  const riskyRatio = (a.thaiStocksAsset + a.foreignStocksAsset + a.crypto + a.goldAsset) / totalA
  const mktLevel: 'green' | 'yellow' | 'red' =
    riskyRatio > 0.80 ? 'red' : riskyRatio > 0.60 ? 'yellow' : 'green'
  cards.push({
    id: 'market',
    name: 'ความเสี่ยงตลาด',
    level: mktLevel,
    punchline: `สินทรัพย์ผันผวน (หุ้น/crypto/ทอง) คิดเป็น ${fmtPct(riskyRatio)} ของทรัพย์สินทั้งหมด${
      mktLevel === 'red' ? ' ถ้าตลาดร่วง 30% พอร์ตรวมจะหายไปประมาณ ' + fmtPct(riskyRatio * 0.3) : ''}`,
    advice: mktLevel !== 'green'
      ? 'กระจายสัดส่วนไปยังสินทรัพย์ที่มั่นคงกว่า เช่น ตราสารหนี้หรือเงินฝากบางส่วน'
      : 'สัดส่วนสินทรัพย์ผันผวนอยู่ในระดับที่สมดุล',
  })

  // 6. Concentration — or investment opportunity nudge when no investable assets yet
  const conc = metrics.concentration
  const noInvestments = metrics.totalInvestmentAssets === 0
  if (noInvestments) {
    // Informational green card: encourage starting to invest with risk disclaimer
    cards.push({
      id: 'concentration',
      name: 'โอกาสในการลงทุน',
      level: 'green',
      punchline: 'คุณยังไม่มีการลงทุน ลองพิจารณาเริ่มลงทุนเพื่อให้เงินของคุณเติบโตในระยะยาว ทั้งนี้การลงทุนมีความเสี่ยง กรุณาศึกษาและใช้วิจารณญาณก่อนตัดสินใจลงทุนทุกครั้ง',
      advice: 'เมื่อพร้อม ควรเริ่มด้วยสินทรัพย์ที่เข้าใจและกระจายไปหลายประเภทตั้งแต่ต้น เพื่อลดความเสี่ยงจากตัวเดียว',
    })
  } else {
    const concLevel: 'green' | 'yellow' | 'red' =
      conc !== null && conc > T.concentrationWarn ? 'yellow' : 'green'
    cards.push({
      id: 'concentration',
      name: 'การกระจุกตัวของสินทรัพย์',
      level: concLevel,
      punchline: concLevel === 'yellow'
        ? `สินทรัพย์ลงทุนตัวเดียวมากถึง ${fmtPct(conc!)} ของพอร์ตลงทุน ถ้าตัวนั้นร่วงพอร์ตกระทบหนัก`
        : `พอร์ตมีการกระจายตัวที่ดี ตัวใหญ่สุดคิดเป็น ${fmtPct(conc!)}`,
      advice: concLevel === 'yellow'
        ? 'เพิ่มการกระจายไปยังสินทรัพย์ประเภทอื่น เพื่อลดความเสี่ยงจากตัวเดียว'
        : 'รักษาการกระจายตัวนี้ไว้',
    })
  }

  // 7. Behavioral
  const panicSell = a.portfolioDrop1Month === 'ขายทั้งหมด'
  const behLevel: 'green' | 'yellow' | 'red' =
    panicSell ? 'red' :
    a.portfolioDrop1Month === 'ขายบางส่วน' ? 'yellow' : 'green'
  cards.push({
    id: 'behavioral',
    name: 'พฤติกรรมการลงทุน',
    level: behLevel,
    punchline: panicSell
      ? 'เมื่อพอร์ตลดลง 20% คุณเลือกขายทั้งหมด พฤติกรรมนี้ทำให้ขาดทุนจริง และพลาดการฟื้นตัวของตลาด'
      : behLevel === 'yellow'
      ? 'เมื่อพอร์ตลดลง 20% คุณมีแนวโน้มขายบางส่วน ซึ่งอาจทำให้พอร์ตฟื้นตัวช้ากว่าที่ควร'
      : 'คุณสามารถอดทนในยามตลาดร่วงได้ดี ซึ่งเป็นคุณสมบัติสำคัญของนักลงทุนระยะยาว',
    advice: behLevel !== 'green'
      ? 'กำหนดแผนการลงทุนล่วงหน้าและยึดมั่นกับมัน หรือลดสัดส่วนสินทรัพย์เสี่ยงให้อยู่ในระดับที่คุณรับได้'
      : 'ใช้จุดแข็งด้านความอดทนนี้ในการลงทุนระยะยาว',
  })

  // 8. Retirement gap
  // retirementMonths = (lifeExpectancy - retirementAge) × 12, from user's own answers.
  // Falls back to 300 months if the derived value is unusable (lifeExpectancy ≤ retirementAge).
  const monthlyRetirement = a.monthlyExpenseAfterRetirement || a.monthlyExpenses || 0
  const lifeExp = a.expectedLifespan || 0
  const retAge = a.retirementAge || 0
  const retirementMonthsDerived = (lifeExp - retAge) * 12
  const usingFallback = retirementMonthsDerived <= 0
  const retirementMonths = usingFallback ? T.retirementGapFallback : retirementMonthsDerived
  const retirementNeeded = monthlyRetirement * retirementMonths
  const currentSavings = a.currentRetirementSavings || 0
  const yearsLeft = metrics.yearsToRetirement
  const projectedSavings = currentSavings + (a.monthlySavings || 0) * 12 * yearsLeft
  const gap = retirementNeeded - projectedSavings
  const retLevel: 'green' | 'yellow' | 'red' = gap > retirementNeeded * 0.5 ? 'red' : gap > 0 ? 'yellow' : 'green'
  const retirementYears = Math.round(retirementMonths / 12)
  cards.push({
    id: 'retirement',
    name: 'ความพร้อมเกษียณ',
    level: retLevel,
    punchline: retLevel === 'green'
      ? `แนวโน้มเงินเกษียณอยู่ที่ ${fmtBaht(projectedSavings)} ครอบคลุมความต้องการ ${fmtBaht(retirementNeeded)} (${retirementYears} ปีหลังเกษียณ${usingFallback ? ' ค่าประมาณ' : ''}) ได้`
      : `ต้องการเงินเกษียณ ${fmtBaht(retirementNeeded)} (${retirementYears} ปีหลังเกษียณ${usingFallback ? ' ค่าประมาณ' : ''}) แต่แนวโน้มมีเพียง ${fmtBaht(projectedSavings)} ขาดอยู่ ${fmtBaht(gap)}`,
    advice: retLevel !== 'green'
      ? `เพิ่มการออมเพื่อเกษียณ เช่น RMF/SSF และลงทุนให้เงินงอกเงย เพื่อปิด gap ${fmtBaht(gap)}`
      : 'เส้นทางเกษียณดูดีแล้ว รักษาระเบียบวินัยการออมไว้',
  })

  // 9. Health/Insurance
  const noHealth = a.hasHealthInsurance === 'ไม่มี'
  const noLife = a.hasLifeInsurance === 'ไม่มี'
  const chronic = a.hasChronicDisease === 'มี'
  const hlLevel: 'green' | 'yellow' | 'red' =
    (noHealth && chronic) || (noLife && a.dependents > 0) ? 'red' :
    noHealth || noLife ? 'yellow' : 'green'
  cards.push({
    id: 'health',
    name: 'สุขภาพและประกัน',
    level: hlLevel,
    punchline: hlLevel === 'red'
      ? `${chronic ? 'มีโรคประจำตัวและ' : ''}${noHealth ? 'ไม่มีประกันสุขภาพ' : ''}${noLife && a.dependents > 0 ? ' ไม่มีประกันชีวิตทั้งที่มีผู้พึ่งพิง' : ''} ค่ารักษาพยาบาลฉุกเฉินอาจทำลายแผนการเงินได้`
      : hlLevel === 'yellow'
      ? 'ความคุ้มครองยังไม่ครบ ถ้าเกิดเหตุฉุกเฉินด้านสุขภาพอาจต้องใช้เงินลงทุน'
      : 'มีความคุ้มครองครบถ้วน ดีมาก',
    advice: hlLevel !== 'green'
      ? 'จัดประกันสุขภาพให้ครบก่อน แล้วค่อยเพิ่มการลงทุน ประกันคือรากฐานของแผนการเงิน'
      : 'ความคุ้มครองครบ ทำให้แผนลงทุนมั่นคงขึ้น',
  })

  // 10. Tax efficiency
  const usesSSF = a.investsSSF === 'ลงทุน'
  const usesRMF = a.investsRMF === 'ลงทุน'
  const taxLevel: 'green' | 'yellow' | 'red' =
    !usesSSF && !usesRMF ? 'yellow' : 'green'
  cards.push({
    id: 'tax',
    name: 'ประสิทธิภาพภาษี',
    level: taxLevel,
    punchline: taxLevel === 'yellow'
      ? `ยังไม่ได้ใช้สิทธิ SSF/RMF ซึ่งสามารถลดภาษีได้สูงสุดหลายหมื่นบาทต่อปี ขึ้นอยู่กับรายได้`
      : `ใช้สิทธิลดหย่อนภาษีผ่านการลงทุนแล้ว ช่วยลดต้นทุนโดยรวม`,
    advice: taxLevel === 'yellow'
      ? 'ศึกษา SSF (ซื้อได้ 30% รายได้ สูงสุด 200,000 บาท) และ RMF เพื่อลดภาษีและสร้างเงินออมระยะยาว'
      : 'ใช้สิทธิให้เต็มเพดานทุกปี เพื่อประหยัดภาษีสูงสุด',
  })

  // Sort: red → yellow → green
  const order = { red: 0, yellow: 1, green: 2 }
  return cards.sort((a, b) => order[a.level] - order[b.level])
}
