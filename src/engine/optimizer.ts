// Markowitz optimizer for Output 3 (individual assets)

export interface PortfolioPoint {
  sigma: number
  mu: number
  weights: number[]
}

export interface TangencyResult {
  weights: number[]
  E: number
  sigma: number
}

export interface OptimalResult {
  yRisky: number
  ySafe: number
  E: number
  sigma: number
  finalWeights: number[]
  leverageFlag: boolean
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0)
}

function portfolioVariance(w: number[], cov: number[][]): number {
  return w.reduce((s, wi, i) =>
    s + w.reduce((ss, wj, j) => ss + wi * wj * cov[i][j], 0), 0
  )
}

function portfolioReturn(w: number[], returns: number[]): number {
  return dot(w, returns)
}

// Minimum variance portfolio for target return via Lagrangian (numerical)
function minVarWeights(
  returns: number[],
  cov: number[][],
  targetReturn: number,
  numAssets: number
): number[] {
  // Gradient descent with constraints (sum=1, return=target)
  let w = Array(numAssets).fill(1 / numAssets)
  const lr = 0.01
  const lambda = 10

  for (let iter = 0; iter < 2000; iter++) {
    const gradVar = w.map((_, i) =>
      2 * w.reduce((s, wj, j) => s + wj * cov[i][j], 0)
    )
    const sumW = w.reduce((s, v) => s + v, 0)
    const currReturn = portfolioReturn(w, returns)
    const gradReturn = returns.map(r => -2 * lambda * (currReturn - targetReturn) * r)
    const gradSum = w.map(() => -2 * lambda * (sumW - 1))

    w = w.map((wi, i) => Math.max(0, wi - lr * (gradVar[i] + gradReturn[i] + gradSum[i])))
    const s = w.reduce((a, b) => a + b, 0)
    if (s > 0) w = w.map(v => v / s)
  }
  return w
}

export function efficientFrontier(
  returns: number[],
  cov: number[][],
  numPoints = 30
): PortfolioPoint[] {
  const minR = Math.min(...returns)
  const maxR = Math.max(...returns)
  const points: PortfolioPoint[] = []

  for (let i = 0; i <= numPoints; i++) {
    const target = minR + (maxR - minR) * (i / numPoints)
    const w = minVarWeights(returns, cov, target, returns.length)
    const mu = portfolioReturn(w, returns)
    const sigma = Math.sqrt(portfolioVariance(w, cov))
    points.push({ sigma, mu, weights: w })
  }
  return points
}

export function tangencyPortfolio(
  returns: number[],
  cov: number[][],
  Rf: number
): TangencyResult {
  const n = returns.length
  let bestSharpe = -Infinity
  let bestW = Array(n).fill(1 / n)

  for (let trial = 0; trial < 50; trial++) {
    // Random starting point
    const raw = Array.from({ length: n }, () => Math.random())
    const sum = raw.reduce((s, v) => s + v, 0)
    let w = raw.map(v => v / sum)

    for (let iter = 0; iter < 1000; iter++) {
      const E = portfolioReturn(w, returns)
      const sigma = Math.sqrt(portfolioVariance(w, cov))
      const sharpe = (E - Rf) / sigma

      const gradE = returns
      const gradSigma = w.map((_, i) =>
        w.reduce((s, wj, j) => s + wj * cov[i][j], 0) / sigma
      )
      const gradSharpe = gradE.map((ge, i) => (ge * sigma - (E - Rf) * gradSigma[i]) / (sigma * sigma))

      const lr = 0.001
      w = w.map((wi, i) => Math.max(0, wi + lr * gradSharpe[i]))
      const s = w.reduce((a, b) => a + b, 0)
      if (s > 0) w = w.map(v => v / s)
    }

    const E = portfolioReturn(w, returns)
    const sigma = Math.sqrt(portfolioVariance(w, cov))
    const sharpe = (E - Rf) / sigma
    if (sharpe > bestSharpe) { bestSharpe = sharpe; bestW = w }
  }

  const E = portfolioReturn(bestW, returns)
  const sigma = Math.sqrt(portfolioVariance(bestW, cov))
  return { weights: bestW, E, sigma }
}

export function optimalForPerson(
  tangency: TangencyResult,
  Rf: number,
  A: number
): OptimalResult {
  let yRisky = (tangency.E - Rf) / (A * tangency.sigma * tangency.sigma)
  let leverageFlag = false
  if (yRisky > 1) { yRisky = 1; leverageFlag = true }
  if (yRisky < 0) yRisky = 0

  const ySafe = 1 - yRisky
  const E = yRisky * tangency.E + ySafe * Rf
  const sigma = yRisky * tangency.sigma
  const finalWeights = tangency.weights.map(w => w * yRisky)

  return { yRisky, ySafe, E, sigma, finalWeights, leverageFlag }
}
