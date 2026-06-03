// Data layer — swap USE_MOCK=false to connect real provider without touching computation
export const USE_MOCK = true

export interface PriceData { ticker: string; price: number; currency: string }
export interface HistoryPoint { date: string; close: number }
export interface FXRate { pair: string; rate: number }
export interface OptionData {
  strike: number; expiry: string; callPrice: number; putPrice: number; impliedVol: number
}

const MOCK_PRICES: Record<string, PriceData> = {
  'PTT':    { ticker: 'PTT',    price: 32.50,  currency: 'THB' },
  'KBANK':  { ticker: 'KBANK',  price: 139.00, currency: 'THB' },
  'AOT':    { ticker: 'AOT',    price: 58.25,  currency: 'THB' },
  'AAPL':   { ticker: 'AAPL',   price: 189.30, currency: 'USD' },
  'MSFT':   { ticker: 'MSFT',   price: 415.00, currency: 'USD' },
  'VTI':    { ticker: 'VTI',    price: 228.50, currency: 'USD' },
  'GLD':    { ticker: 'GLD',    price: 185.00, currency: 'USD' },
  'AGG':    { ticker: 'AGG',    price: 97.20,  currency: 'USD' },
  'SET50':  { ticker: 'SET50',  price: 850.00, currency: 'THB' },
}

const MOCK_FX: Record<string, FXRate> = {
  'USDTHB': { pair: 'USDTHB', rate: 35.50 },
  'EURTHB': { pair: 'EURTHB', rate: 38.20 },
}

function generateHistory(basePrice: number, days = 252): HistoryPoint[] {
  const history: HistoryPoint[] = []
  let price = basePrice
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    price = price * (1 + (Math.random() - 0.48) * 0.02)
    history.push({ date: d.toISOString().slice(0, 10), close: parseFloat(price.toFixed(2)) })
  }
  return history
}

export function getPrice(ticker: string): PriceData | null {
  return MOCK_PRICES[ticker] ?? null
}

export function getHistory(ticker: string): HistoryPoint[] {
  const p = MOCK_PRICES[ticker]
  if (!p) return []
  return generateHistory(p.price)
}

export function getFX(pair: string): FXRate | null {
  return MOCK_FX[pair] ?? null
}

export function getOptionChain(ticker: string): OptionData[] {
  const p = MOCK_PRICES[ticker]
  if (!p) return []
  const S = p.price
  return [-0.10, -0.05, 0, 0.05, 0.10].map(dK => {
    const K = S * (1 + dK)
    const iv = 0.20 + Math.abs(dK) * 0.5
    return { strike: K, expiry: '2025-12-31', callPrice: S * 0.05, putPrice: S * 0.04, impliedVol: iv }
  })
}

export const MOCK_TICKERS = Object.keys(MOCK_PRICES)

export const THAI_TICKERS = ['PTT', 'KBANK', 'AOT', 'SET50']
export const FOREIGN_TICKERS = ['AAPL', 'MSFT', 'VTI']
export const BOND_TICKERS = ['AGG']
export const GOLD_TICKERS = ['GLD']
