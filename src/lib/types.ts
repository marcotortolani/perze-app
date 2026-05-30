// ─── Core domain types ────────────────────────────────────────────────────────

export interface Currency {
  code: string // ISO 4217, e.g. "USD", "ARS"
  name: string
  symbol: string
  decimals: number
}

export interface Country {
  code: string // ISO 3166-1 alpha-2, e.g. "AR", "UY"
  name: string
  flag: string // emoji flag
  currencyCodes: string[]
}

export interface ExchangeRate {
  currencyCode: string
  perUSD: number // how many of this currency equal 1 USD
  updatedAt: string // ISO date-time string
}

export type TransactionType = 'income' | 'expense' | 'investment'

export interface Category {
  id: string
  name: string
  icon: string // lucide icon name, e.g. "ShoppingCart"
  type: TransactionType | 'all'
  color: string // hex color, e.g. "#10b981"
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  currencyCode: string
  countryCode: string
  categoryId: string
  date: string // ISO date string
  description: string
  notes?: string
  source: 'manual' | 'ai-receipt'
  receiptId?: string
  tags?: string[]
  createdAt: string // ISO date-time string
}

export interface User {
  id: string
  name: string
  email: string
  createdAt: string // ISO date-time string
}

export type AccentColor = 'emerald' | 'violet' | 'blue' | 'rose' | 'amber'

export type Theme = 'light' | 'dark' | 'system'

// ─── Default data ─────────────────────────────────────────────────────────────

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', decimals: 2 },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', decimals: 0 },
  { code: 'UYU', name: 'Peso uruguayo', symbol: '$U', decimals: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
]

export const DEFAULT_COUNTRIES: Country[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', currencyCodes: ['ARS', 'USD'] },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', currencyCodes: ['UYU', 'USD'] },
]

export const DEFAULT_CATEGORIES: Category[] = [
  // income
  {
    id: 'salary',
    name: 'Sueldo',
    icon: 'Briefcase',
    type: 'income',
    color: '#10b981',
  },
  {
    id: 'freelance',
    name: 'Freelance',
    icon: 'Laptop',
    type: 'income',
    color: '#06b6d4',
  },
  {
    id: 'investment-return',
    name: 'Retorno inversión',
    icon: 'TrendingUp',
    type: 'income',
    color: '#8b5cf6',
  },
  {
    id: 'other-income',
    name: 'Otro ingreso',
    icon: 'Plus',
    type: 'income',
    color: '#6b7280',
  },
  // expense
  {
    id: 'food',
    name: 'Supermercado',
    icon: 'ShoppingCart',
    type: 'expense',
    color: '#ef4444',
  },
  {
    id: 'transport',
    name: 'Transporte',
    icon: 'Car',
    type: 'expense',
    color: '#f59e0b',
  },
  {
    id: 'housing',
    name: 'Vivienda',
    icon: 'Home',
    type: 'expense',
    color: '#3b82f6',
  },
  {
    id: 'health',
    name: 'Salud',
    icon: 'Heart',
    type: 'expense',
    color: '#ec4899',
  },
  {
    id: 'entertainment',
    name: 'Entretenimiento',
    icon: 'Music',
    type: 'expense',
    color: '#a855f7',
  },
  {
    id: 'education',
    name: 'Educación',
    icon: 'BookOpen',
    type: 'expense',
    color: '#14b8a6',
  },
  {
    id: 'clothing',
    name: 'Ropa',
    icon: 'Shirt',
    type: 'expense',
    color: '#f97316',
  },
  {
    id: 'subscriptions',
    name: 'Suscripciones',
    icon: 'Repeat',
    type: 'expense',
    color: '#6366f1',
  },
  {
    id: 'services',
    name: 'Servicios',
    icon: 'Zap',
    type: 'expense',
    color: '#84cc16',
  },
  {
    id: 'other-expense',
    name: 'Otro gasto',
    icon: 'MoreHorizontal',
    type: 'expense',
    color: '#6b7280',
  },
  // investment
  {
    id: 'stocks',
    name: 'Acciones',
    icon: 'LineChart',
    type: 'investment',
    color: '#0ea5e9',
  },
  {
    id: 'crypto',
    name: 'Cripto',
    icon: 'Bitcoin',
    type: 'investment',
    color: '#f59e0b',
  },
  {
    id: 'real-estate',
    name: 'Inmuebles',
    icon: 'Building',
    type: 'investment',
    color: '#10b981',
  },
  {
    id: 'bonds',
    name: 'Bonos',
    icon: 'FileText',
    type: 'investment',
    color: '#6366f1',
  },
  {
    id: 'savings',
    name: 'Ahorro',
    icon: 'PiggyBank',
    type: 'investment',
    color: '#14b8a6',
  },
  {
    id: 'other-investment',
    name: 'Otra inversión',
    icon: 'Wallet',
    type: 'investment',
    color: '#6b7280',
  },
]

export const DEFAULT_EXCHANGE_RATES: ExchangeRate[] = [
  { currencyCode: 'USD', perUSD: 1, updatedAt: new Date().toISOString() },
  { currencyCode: 'ARS', perUSD: 1200, updatedAt: new Date().toISOString() },
  { currencyCode: 'UYU', perUSD: 42, updatedAt: new Date().toISOString() },
  { currencyCode: 'EUR', perUSD: 0.92, updatedAt: new Date().toISOString() },
]
