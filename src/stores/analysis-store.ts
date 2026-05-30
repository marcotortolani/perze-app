import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AnalysisSummarySnapshot {
  totalIncome: number
  totalExpenses: number
  totalInvestments: number
  netBalance: number
  displayCurrency: string
  period: string
}

export interface InsightsData {
  summary: string
  healthScore: number
  observations: Array<{
    type: "positive" | "warning" | "critical" | "info"
    title: string
    description: string
    category: "income" | "expense" | "investment" | "savings" | "general"
  }>
  suggestions: Array<{
    priority: "high" | "medium" | "low"
    title: string
    description: string
    actionable: string
  }>
  alerts: Array<{
    type: "overspending" | "low-income" | "no-savings" | "high-debt" | "opportunity"
    message: string
    severity: "low" | "medium" | "high"
  }>
  savingsOpportunity?: number
}

export interface SavedAnalysis {
  id: string
  data: InsightsData
  snapshot: AnalysisSummarySnapshot
  generatedAt: string // ISO string
}

interface AnalysisState {
  current: SavedAnalysis | null
  history: SavedAnalysis[]
}

interface AnalysisActions {
  saveAnalysis: (data: InsightsData, snapshot: AnalysisSummarySnapshot) => void
  clearHistory: () => void
  removeFromHistory: (id: string) => void
}

const MAX_HISTORY = 10

export const useAnalysisStore = create<AnalysisState & AnalysisActions>()(
  persist(
    (set, get) => ({
      current: null,
      history: [],

      saveAnalysis: (data, snapshot) => {
        const { current, history } = get()
        const newEntry: SavedAnalysis = {
          id: crypto.randomUUID(),
          data,
          snapshot,
          generatedAt: new Date().toISOString(),
        }
        // Move current to history before replacing it
        const updatedHistory = current
          ? [current, ...history].slice(0, MAX_HISTORY)
          : history
        set({ current: newEntry, history: updatedHistory })
      },

      clearHistory: () => set({ history: [] }),

      removeFromHistory: (id) =>
        set((state) => ({ history: state.history.filter((a) => a.id !== id) })),
    }),
    { name: "finanzas-analysis" }
  )
)
