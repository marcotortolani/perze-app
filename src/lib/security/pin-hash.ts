/**
 * B12 — el PIN se hasheaba con un solo `SHA-256(pin)` sin sal ni
 * estiramiento: un PIN de 4-6 dígitos son ≤10^6 candidatos, y SHA-256 es
 * rápido a propósito (miles de millones de hashes/segundo en GPU) — un
 * dump de `localStorage` lo revierte en milisegundos, y el PIN suele
 * reutilizarse con el del teléfono. PBKDF2-SHA256 con sal por dispositivo
 * y 250.000 iteraciones no lo vuelve inrompible (sigue siendo un PIN corto
 * guardado en el propio dispositivo, ver B13 — el modelo de amenaza real
 * es "disuade miradas", no un atacante con tiempo), pero sube el costo de
 * fuerza bruta varios órdenes de magnitud y saca la sal del texto plano.
 */
const PBKDF2_ITERATIONS = 250_000;
const HASH_BITS = 256;

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

/** Hash actual — requiere la sal por dispositivo generada en `generateSalt()`. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(salt) as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS
  );
  return bytesToHex(new Uint8Array(derived));
}

/**
 * Esquema viejo (sin sal, SHA-256 directo) — solo para migrar en `verify()`
 * el hash de quien ya tenía un PIN configurado antes de este fix. Nunca se
 * usa para hashear un PIN nuevo.
 */
export async function hashPinLegacy(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

/** Comparación en tiempo constante — un `===` de hex filtra por timing en qué posición difieren dos hashes (B13). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
