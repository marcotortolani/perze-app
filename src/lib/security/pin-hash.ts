/**
 * L6: el PIN nunca se guarda en texto plano — solo el hash SHA-256 (hex)
 * vía Web Crypto. No es para resistir un ataque criptográfico serio (es un
 * PIN de 4-6 dígitos guardado en el propio dispositivo del usuario): es
 * para que un dump de `localStorage` no muestre el PIN tal cual.
 */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
