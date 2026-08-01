import { v7 as uuidv7 } from "uuid";

/** IDs generados en el cliente (UUID v7) — idempotencia offline, ver CLAUDE.md. */
export function newId(): string {
  return uuidv7();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** D10 — reexportado desde `lib/dates/today.ts`: ver ahí por qué ya no es `nowIso().slice(0, 10)`. */
export { todayIso } from "../dates/today";
