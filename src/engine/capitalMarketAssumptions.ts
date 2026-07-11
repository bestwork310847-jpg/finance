// Capital Market Assumptions — review periodically before deploy
// Sources: historical averages, analyst consensus (as of 2024-2025)
// *** Update these numbers before going live ***

export const ASSET_NAMES = ['thaiStocks', 'foreignStocks', 'bonds', 'gold'] as const
export type AssetName = typeof ASSET_NAMES[number]

export const CMA = {
  assets: {
    // Sharpe per asset (vs Rf=2%): Thai≈0.23, Foreign≈0.30, Bonds≈0.10, Gold≈0.13
    // Tangency portfolio Sharpe ≈ 0.38–0.45 after diversification
    // y*(A=4) ≈ 0.75 → ~25% cash; y*(A=8) ≈ 0.38 → ~62% cash
    thaiStocks:    { expectedReturn: 0.07, volatility: 0.22, label: 'หุ้นไทย' },
    foreignStocks: { expectedReturn: 0.08, volatility: 0.20, label: 'หุ้นต่างประเทศ' },
    bonds:         { expectedReturn: 0.025, volatility: 0.05, label: 'ตราสารหนี้' },
    gold:          { expectedReturn: 0.04, volatility: 0.16, label: 'ทองคำ' },
  },
  riskFreeRate: 0.02,
  cashLabel: 'เงินสด/พันธบัตรรัฐ',
  // Correlation matrix order: [thaiStocks, foreignStocks, bonds, gold]
  correlations: [
    [1.00,  0.60, -0.10,  0.10],
    [0.60,  1.00, -0.20,  0.05],
    [-0.10,-0.20,  1.00,  0.10],
    [0.10,  0.05,  0.10,  1.00],
  ],
}
