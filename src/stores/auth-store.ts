import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type User } from "@/lib/types"
import { hashPassword } from "@/lib/hash"

// ─── Internal type ─────────────────────────────────────────────────────────────
// Passwords are stored as FNV-1a hashes — not plaintext.
// This is still mock-only; replace with real auth in Phase 6.
interface StoredUser extends User {
  _passwordHash: string
}

interface AuthState {
  currentUser: User | null
  isAuthenticated: boolean
  _users: StoredUser[]
}

interface AuthActions {
  register: (name: string, email: string, password: string) => { success: boolean; error?: string }
  login: (email: string, password: string) => { success: boolean; error?: string }
  logout: () => void
  requestPasswordReset: (email: string) => { success: boolean; error?: string }
  resetPassword: (email: string, newPassword: string) => { success: boolean; error?: string }
  updateProfile: (data: Partial<Pick<User, "name">>) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // ─── State ────────────────────────────────────────────────────────────
      currentUser: null,
      isAuthenticated: false,
      _users: [],

      // ─── Actions ──────────────────────────────────────────────────────────
      register: (name, email, password) => {
        const { _users } = get()
        const normalizedEmail = email.trim().toLowerCase()

        if (!name.trim()) return { success: false, error: "El nombre es obligatorio." }
        if (!normalizedEmail.includes("@")) return { success: false, error: "El correo electrónico no es válido." }
        if (password.length < 6) return { success: false, error: "La contraseña debe tener al menos 6 caracteres." }

        if (_users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
          return { success: false, error: "Ya existe una cuenta con ese correo electrónico." }
        }

        const newUser: StoredUser = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
          _passwordHash: hashPassword(password),
        }

        set((state) => ({
          _users: [...state._users, newUser],
          currentUser: toPublicUser(newUser),
          isAuthenticated: true,
        }))

        return { success: true }
      },

      login: (email, password) => {
        const { _users } = get()
        const normalizedEmail = email.trim().toLowerCase()
        const hash = hashPassword(password)

        const found = _users.find(
          (u) => u.email.toLowerCase() === normalizedEmail && u._passwordHash === hash
        )

        if (!found) return { success: false, error: "Correo electrónico o contraseña incorrectos." }

        set({ currentUser: toPublicUser(found), isAuthenticated: true })
        return { success: true }
      },

      logout: () => set({ currentUser: null, isAuthenticated: false }),

      requestPasswordReset: (email) => {
        const { _users } = get()
        const exists = _users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!exists) return { success: false, error: "No existe ninguna cuenta con ese correo electrónico." }
        return { success: true }
      },

      resetPassword: (email, newPassword) => {
        const { _users } = get()
        const normalizedEmail = email.trim().toLowerCase()

        if (newPassword.length < 6) return { success: false, error: "La contraseña debe tener al menos 6 caracteres." }

        const index = _users.findIndex((u) => u.email.toLowerCase() === normalizedEmail)
        if (index === -1) return { success: false, error: "No existe ninguna cuenta con ese correo electrónico." }

        const updatedUsers = _users.map((u, i) =>
          i === index ? { ...u, _passwordHash: hashPassword(newPassword) } : u
        )
        set({ _users: updatedUsers })
        return { success: true }
      },

      updateProfile: (data) => {
        const { currentUser, _users } = get()
        if (!currentUser) return

        const updatedUsers = _users.map((u) => (u.id === currentUser.id ? { ...u, ...data } : u))
        const updatedUser = updatedUsers.find((u) => u.id === currentUser.id)
        set({
          _users: updatedUsers,
          currentUser: updatedUser ? toPublicUser(updatedUser) : currentUser,
        })
      },
    }),
    {
      name: "finanzas-auth",
      // Persist session and users, but _users only stores password hashes (not plaintext)
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        _users: state._users,
      }),
    }
  )
)

// ─── Helper ────────────────────────────────────────────────────────────────────

function toPublicUser(stored: StoredUser): User {
  const { _passwordHash: _h, ...user } = stored
  return user
}
