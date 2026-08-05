import * as z from "zod";

/**
 * Email normalizado: `trim` + minúsculas antes de validar. La normalización
 * va en el schema y no en la pantalla porque el dato viaja a la base —
 * `household_invites.email` se compara después contra el email de la sesión,
 * y `Ana@Gmail.com` y `ana@gmail.com` son la misma persona.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Variante para campos opcionales: vacío es válido y devuelve `null`, que es
 * lo que la columna espera cuando no se cargó nada.
 */
export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.email().safeParse(v).success);

/** Normaliza sin validar — para el `onChange`, que corre en cada tecla. */
export function normalizeEmail(value: string): string {
  return value.toLowerCase().replace(/\s/g, "");
}

export type EmailProblem = "missingAt" | "missingDomain" | "invalid";

/**
 * Qué le falta al email, para que el error proponga la corrección en vez de
 * nombrarla (CLAUDE.md § interfaz). Devuelve `null` si es válido o si está
 * vacío — un campo opcional vacío no es un error.
 */
export function diagnoseEmail(value: string): EmailProblem | null {
  const email = normalizeEmail(value);
  if (email === "") return null;
  if (emailSchema.safeParse(email).success) return null;
  if (!email.includes("@")) return "missingAt";
  const domain = email.slice(email.indexOf("@") + 1);
  if (domain !== "" && !domain.includes(".")) return "missingDomain";
  return "invalid";
}

/**
 * El email que probablemente quiso escribir, para incrustar en el mensaje.
 * `null` cuando no hay nada razonable que sugerir y el mensaje cae en el
 * ejemplo genérico.
 */
export function suggestEmail(value: string): string | null {
  const email = normalizeEmail(value);
  const problem = diagnoseEmail(email);
  if (problem === "missingAt") return email === "" ? null : `${email}@gmail.com`;
  if (problem === "missingDomain") return `${email}.com`;
  return null;
}
