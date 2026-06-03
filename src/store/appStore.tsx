import React, { createContext, useContext, useReducer } from 'react'
import type { Answers, MetricsResult, RiskCard, RiskCoefficientResult, AllocationResult } from '../engine/types'

interface AppState {
  answers: Answers | null
  metrics: MetricsResult | null
  riskResult: RiskCoefficientResult | null
  riskCards: RiskCard[]
  allocation: AllocationResult | null
}

type Action =
  | { type: 'SET_ANSWERS'; payload: Answers }
  | { type: 'SET_METRICS'; payload: MetricsResult }
  | { type: 'SET_RISK_RESULT'; payload: RiskCoefficientResult }
  | { type: 'SET_RISK_CARDS'; payload: RiskCard[] }
  | { type: 'SET_ALLOCATION'; payload: AllocationResult }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ANSWERS': return { ...state, answers: action.payload }
    case 'SET_METRICS': return { ...state, metrics: action.payload }
    case 'SET_RISK_RESULT': return { ...state, riskResult: action.payload }
    case 'SET_RISK_CARDS': return { ...state, riskCards: action.payload }
    case 'SET_ALLOCATION': return { ...state, allocation: action.payload }
    default: return state
  }
}

const initial: AppState = {
  answers: null, metrics: null, riskResult: null, riskCards: [], allocation: null,
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
