/**
 * FNV-1a 32-bit hash — synchronous, deterministic, no external deps.
 * NOT cryptographically secure. Used only for the mock auth system
 * to avoid storing plaintext passwords in localStorage.
 * Replace with bcrypt/Argon2 when real auth is implemented (Phase 6).
 */
export function hashPassword(password: string): string {
  const SALT = "finanzas-app-salt-2026"
  const input = SALT + password

  let hash = 2166136261 // FNV-1a offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0 // FNV prime, unsigned 32-bit
  }

  return hash.toString(16).padStart(8, "0")
}
