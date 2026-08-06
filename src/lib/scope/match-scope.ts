import type { Scope } from "@/stores/scope-store";

/**
 * El switch Personal/Compartido/Todo del header (`docs/02-design-system.md`
 * § 8) filtra por `accounts.visibility`, la misma columna que ya rige RLS:
 * `private` es "solo yo la veo" — coincide exactamente con "Personal", no
 * hace falta comparar `ownerId` porque RLS nunca deja llegar la cuenta
 * privada de otro miembro. `household`/`custom` son las dos formas de
 * "algo del hogar ve esto", así que las dos caen en "Compartido". `all` no
 * filtra — es la unión, el comportamiento de siempre antes de este switch.
 */
export function accountMatchesScope(visibility: "private" | "household" | "custom", scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "personal") return visibility === "private";
  return visibility !== "private";
}
