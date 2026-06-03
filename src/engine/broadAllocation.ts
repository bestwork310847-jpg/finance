import type { AllocationResult } from './types'
import { CMA, ASSET_NAMES } from './capitalMarketAssumptions'

// Simple matrix operations
function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, m = B[0].length, k = B.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) =>
      Array.from({ length: k }, (_, l) => A[i][l] * B[l][j]).reduce((s, v) => s + v, 0)
    )
  )
}

function matVec(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((s, a, i) => s + a * v[i], 0))
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0)
}

// Build covariance matrix from correlations and volatilities
function buildCov(): number[][] {
  const n = ASSET_NAMES.length
  const sigmas = ASSET_NAMES.map(k => CMA.assets[k].volatility)
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      CMA.correlations[i][j] * sigmas[i] * sigmas[j]
    )
  )
}

// Invert 4x4 matrix via Gauss-Jordan
function invert4x4(m: number[][]): number[][] {
  const n = m.length
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    const div = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}

export function broadAllocation(A: number): AllocationResult {
  const Rf = CMA.riskFreeRate
  const mus = ASSET_NAMES.map(k => CMA.assets[k].expectedReturn)
  const excessReturns = mus.map(m => m - Rf)

  const cov = buildCov()
  const covInv = invert4x4(cov)

  // Tangency weights: w ∝ Σ^-1 * (μ - Rf)
  const rawW = matVec(covInv, excessReturns)
  const sumW = rawW.reduce((s, v) => s + v, 0)
  const tangencyW = rawW.map(w => w / sumW)

  // Tangency portfolio stats
  const E_t = dot(tangencyW, mus)
  const sigma_t = Math.sqrt(
    tangencyW.reduce((s, wi, i) =>
      s + tangencyW.reduce((ss, wj, j) => ss + wi * wj * cov[i][j], 0), 0
    )
  )

  // Optimal allocation on CAL
  let yRisky = (E_t - Rf) / (A * sigma_t * sigma_t)
  let leverageFlag = false
  if (yRisky > 1) { yRisky = 1; leverageFlag = true }
  if (yRisky < 0) yRisky = 0

  const ySafe = 1 - yRisky

  const weights = {
    thaiStocks:    yRisky * tangencyW[0],
    foreignStocks: yRisky * tangencyW[1],
    bonds:         yRisky * tangencyW[2],
    gold:          yRisky * tangencyW[3],
    cash:          ySafe,
  }

  const expectedReturn = dot(tangencyW, mus) * yRisky + Rf * ySafe
  const expectedRisk = sigma_t * yRisky

  return { weights, expectedReturn, expectedRisk, leverageFlag, yRisky }
}
