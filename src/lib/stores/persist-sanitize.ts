/**
 * Saneamiento de estado persistido de Zustand — mismo criterio que
 * `src/lib/backdrop/apply-backdrop.ts` (`getStoredBackdropPreference`),
 * generalizado para los stores de `src/stores/*`: cualquier valor que no
 * matchee la forma esperada (JSON editado a mano, un downgrade, un campo
 * corrupto) cae a un default explícito en vez de propagarse a la app.
 */

export function oneOf<T extends string>(allowed: readonly T[], fallback: T): (v: unknown) => T {
  return (v) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
}

export function boolOr(fallback: boolean): (v: unknown) => boolean {
  return (v) => (typeof v === "boolean" ? v : fallback);
}

export function stringOr(fallback: string): (v: unknown) => string {
  return (v) => (typeof v === "string" ? v : fallback);
}

export function nullableStringOr(): (v: unknown) => string | null {
  return (v) => (typeof v === "string" ? v : null);
}

export function nullableNumberOr(): (v: unknown) => number | null {
  return (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
}

export function stringArrayOr(): (v: unknown) => string[] {
  return (v) => (Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : []);
}

/**
 * Arma el par `migrate`/`merge` de las opciones de `persist()` a partir de
 * un sanitizador. Por cómo lo llama `zustand/middleware` internamente,
 * `merge` corre en TODA rehidratación —con o sin cambio de versión—, así
 * que sanear ahí ya cubre el JSON corrupto de cualquier versión. `migrate`
 * hace falta igual: sin él, un cambio de versión sin función de migración
 * hace que `zustand` tire (destructuring de un resultado `undefined`) en
 * vez de caer a defaults. Los métodos del store —que `persist` nunca
 * guarda— sobreviven porque `merge` parte de `current`, no de
 * `sanitize(persisted)`.
 */
export function sanitizedPersist<S, P>(
  sanitize: (persisted: unknown) => P
): {
  migrate: (persisted: unknown, version: number) => P;
  merge: (persisted: unknown, current: S) => S;
} {
  return {
    migrate: (persisted) => sanitize(persisted),
    merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
  };
}
