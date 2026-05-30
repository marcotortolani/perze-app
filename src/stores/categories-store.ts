import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  type Category,
  type TransactionType,
  DEFAULT_CATEGORIES,
} from "@/lib/types"

interface CategoriesState {
  categories: Category[]
}

interface CategoriesActions {
  addCategory: (category: Category) => void
  updateCategory: (id: string, data: Partial<Category>) => void
  removeCategory: (id: string) => void
  getCategoriesByType: (type: TransactionType | "all") => Category[]
}

type CategoriesStore = CategoriesState & CategoriesActions

export const useCategoriesStore = create<CategoriesStore>()(
  persist(
    (set, get) => ({
      // ─── State ────────────────────────────────────────────────────────────
      categories: DEFAULT_CATEGORIES,

      // ─── Actions ──────────────────────────────────────────────────────────
      addCategory: (category) =>
        set((state) => ({
          categories: [...state.categories, category],
        })),

      updateCategory: (id, data) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        })),

      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),

      getCategoriesByType: (type) => {
        const { categories } = get()
        if (type === "all") return categories
        return categories.filter((c) => c.type === type || c.type === "all")
      },
    }),
    { name: "finanzas-categories" }
  )
)
