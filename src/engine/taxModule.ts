// *** Tax rates — verify before deploy, update every year ***
// Based on Thai tax law as of 2024-2025

export const TAX_CONSTANTS = {
  progressiveRates: [
    { upTo: 150_000,   rate: 0.00 },
    { upTo: 300_000,   rate: 0.05 },
    { upTo: 500_000,   rate: 0.10 },
    { upTo: 750_000,   rate: 0.15 },
    { upTo: 1_000_000, rate: 0.20 },
    { upTo: 2_000_000, rate: 0.25 },
    { upTo: 5_000_000, rate: 0.30 },
    { upTo: Infinity,  rate: 0.35 },
  ],
  dividendWithholdingThai: 0.10,
  dividendWithholdingForeign: 0.15,
  ssfMaxDeduction: 200_000,       // SSF max deduction THB
  ssfMaxPctOfIncome: 0.30,        // SSF max 30% of income
  rmfMaxPctOfIncome: 0.30,        // RMF max 30% of income
  rmfCombinedMax: 500_000,        // RMF + SSF + others combined max
  foreignGainResidencyDays: 180,  // must reside >180 days in Thailand
  foreignGainRuleYear: 2024,      // gains from this year onward are taxable
  standardDeductionEmployed: 0.50, // 50% of income
  standardDeductionMax: 100_000,
  personalAllowance: 60_000,
}

function computeProgressiveTax(taxableIncome: number): number {
  const rates = TAX_CONSTANTS.progressiveRates
  let tax = 0
  let prev = 0
  for (const bracket of rates) {
    if (taxableIncome <= prev) break
    const slice = Math.min(taxableIncome, bracket.upTo) - prev
    tax += slice * bracket.rate
    prev = bracket.upTo
  }
  return tax
}

export interface PortfolioTaxInput {
  thaiStocksDividend: number
  foreignStocksDividend: number
  foreignStocksGain: number
  bondInterest: number
  ssfAmount: number
  rmfAmount: number
}

export interface PersonTaxInfo {
  annualIncome: number
  daysInThailand: number
  remitForeignGains: boolean
  existingDeductions: number
}

export interface TaxResult {
  taxOnThaiDividends: number
  taxOnForeignDividends: number
  taxOnForeignGains: number
  ssfTaxSaving: number
  rmfTaxSaving: number
  totalTax: number
  afterTaxReturn: number
  grossReturn: number
  disclaimer: string
}

export function afterTaxReturn(
  portfolio: PortfolioTaxInput,
  person: PersonTaxInfo
): TaxResult {
  const C = TAX_CONSTANTS

  // Thai stock dividends: 10% withholding
  const taxOnThaiDividends = portfolio.thaiStocksDividend * C.dividendWithholdingThai

  // Foreign dividends: 15% withholding at source
  const taxOnForeignDividends = portfolio.foreignStocksDividend * C.dividendWithholdingForeign

  // Foreign capital gains (rule from 2024)
  let taxOnForeignGains = 0
  const allConditionsMet =
    portfolio.foreignStocksGain > 0 &&
    person.daysInThailand > C.foreignGainResidencyDays &&
    person.remitForeignGains

  if (allConditionsMet) {
    const standardDeduction = Math.min(
      person.annualIncome * C.standardDeductionEmployed,
      C.standardDeductionMax
    )
    const taxableBase = Math.max(
      0,
      person.annualIncome + portfolio.foreignStocksGain
      - standardDeduction - C.personalAllowance - person.existingDeductions
    )
    const totalTax = computeProgressiveTax(taxableBase)
    const baseOnlyTax = computeProgressiveTax(
      Math.max(0, person.annualIncome - standardDeduction - C.personalAllowance - person.existingDeductions)
    )
    taxOnForeignGains = totalTax - baseOnlyTax
  }

  // SSF deduction (tax saving)
  const ssfDeductible = Math.min(
    portfolio.ssfAmount,
    C.ssfMaxDeduction,
    person.annualIncome * C.ssfMaxPctOfIncome
  )
  const standardDeduction = Math.min(
    person.annualIncome * C.standardDeductionEmployed,
    C.standardDeductionMax
  )
  const baseTaxable = Math.max(
    0,
    person.annualIncome - standardDeduction - C.personalAllowance - person.existingDeductions
  )
  const afterSSFTaxable = Math.max(0, baseTaxable - ssfDeductible)
  const ssfTaxSaving = computeProgressiveTax(baseTaxable) - computeProgressiveTax(afterSSFTaxable)

  const rmfDeductible = Math.min(
    portfolio.rmfAmount,
    person.annualIncome * C.rmfMaxPctOfIncome,
    C.rmfCombinedMax - ssfDeductible
  )
  const afterRMFTaxable = Math.max(0, afterSSFTaxable - rmfDeductible)
  const rmfTaxSaving = computeProgressiveTax(afterSSFTaxable) - computeProgressiveTax(afterRMFTaxable)

  const totalTax = taxOnThaiDividends + taxOnForeignDividends + taxOnForeignGains - ssfTaxSaving - rmfTaxSaving
  const grossReturn =
    portfolio.thaiStocksDividend + portfolio.foreignStocksDividend +
    portfolio.foreignStocksGain + portfolio.bondInterest
  const afterTaxReturnVal = grossReturn - totalTax

  return {
    taxOnThaiDividends,
    taxOnForeignDividends,
    taxOnForeignGains,
    ssfTaxSaving,
    rmfTaxSaving,
    totalTax,
    afterTaxReturn: afterTaxReturnVal,
    grossReturn,
    disclaimer:
      'ตัวเลขนี้เป็นประมาณการเท่านั้น กรุณายืนยันกับนักบัญชีหรือสรรพากรก่อนการตัดสินใจจริง กฎภาษีอาจเปลี่ยนแปลงได้',
  }
}
