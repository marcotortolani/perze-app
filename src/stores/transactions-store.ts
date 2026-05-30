import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type Transaction, type TransactionType } from "@/lib/types"
import { TransactionSchema } from "@/lib/schemas"

interface TransactionsState {
  transactions: Transaction[]
}

interface TransactionsActions {
  addTransaction: (
    data: Omit<Transaction, "id" | "createdAt">
  ) => { success: true; transaction: Transaction } | { success: false; error: string }
  updateTransaction: (
    id: string,
    data: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => { success: true } | { success: false; error: string }
  removeTransaction: (id: string) => void
  getTransactionsByType: (type: TransactionType) => Transaction[]
  getRecentTransactions: (limit: number) => Transaction[]
}

type TransactionsStore = TransactionsState & TransactionsActions

export const useTransactionsStore = create<TransactionsStore>()(
  persist(
    (set, get) => ({
      // ─── State ────────────────────────────────────────────────────────────
      transactions: [],

      // ─── Actions ──────────────────────────────────────────────────────────
      addTransaction: (data) => {
        const result = TransactionSchema.safeParse(data)
        if (!result.success) {
          const firstError = result.error.issues[0]?.message ?? "Datos inválidos"
          return { success: false, error: firstError }
        }

        const transaction: Transaction = {
          ...result.data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          transactions: [transaction, ...state.transactions],
        }))

        return { success: true, transaction }
      },

      updateTransaction: (id, data) => {
        const existing = get().transactions.find((t) => t.id === id)
        if (!existing) return { success: false, error: "Movimiento no encontrado" }

        // Merge with existing and validate the full merged object
        const merged = { ...existing, ...data }
        const result = TransactionSchema.safeParse(merged)
        if (!result.success) {
          const firstError = result.error.issues[0]?.message ?? "Datos inválidos"
          return { success: false, error: firstError }
        }

        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...result.data } : t
          ),
        }))

        return { success: true }
      },

      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      getTransactionsByType: (type) =>
        get().transactions.filter((t) => t.type === type),

      getRecentTransactions: (limit) =>
        [...get().transactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit),
    }),
    { name: "finanzas-transactions" }
  )
)
