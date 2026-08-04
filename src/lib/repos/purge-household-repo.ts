import { createClient } from "../supabase/client";
import { getDb } from "../db/client";

export type PurgeStepKey =
  | "transactions"
  | "investments"
  | "recurring_debts"
  | "budgets_goals"
  | "accounts"
  | "categories_rules"
  | "fx_prefs";

export interface PurgeStep {
  key: PurgeStepKey;
  labelKey: string;
}

/**
 * Orden real de borrado en el servidor — respeta las FK del esquema
 * (ninguna tabla de household tiene `ON DELETE CASCADE`, así que el orden
 * entre pasos importa: `transactions`/`investments`/`recurring_debts`/
 * `budgets_goals` antes que `accounts`, porque todos tienen una FK
 * `account_id` que apunta ahí — ver el comentario completo en
 * `20260804000000_purge_household.sql`). No reordenar sin revisar esa
 * migración.
 */
export const PURGE_STEPS: PurgeStep[] = [
  { key: "transactions", labelKey: "dataPage.purge.steps.transactions" },
  { key: "investments", labelKey: "dataPage.purge.steps.investments" },
  { key: "recurring_debts", labelKey: "dataPage.purge.steps.recurringDebts" },
  { key: "budgets_goals", labelKey: "dataPage.purge.steps.budgetsGoals" },
  { key: "accounts", labelKey: "dataPage.purge.steps.accounts" },
  { key: "categories_rules", labelKey: "dataPage.purge.steps.categoriesRules" },
  { key: "fx_prefs", labelKey: "dataPage.purge.steps.fxPrefs" },
];

/** Un paso — `purge_household_step` (SECURITY DEFINER) valida que el caller sea owner y devuelve cuántas filas borró. */
export async function runPurgeStep(householdId: string, step: PurgeStepKey): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("purge_household_step", { p_household_id: householdId, p_step: step });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Limpieza del caché local, solo después de que los 7 pasos remotos
 * terminaron bien — nunca antes, para no vaciar Dexie si el borrado
 * remoto todavía puede fallar a mitad de camino. A diferencia de
 * `signOut()` (que tira toda la base con `getDb().delete()`), acá el
 * usuario sigue logueado y en el mismo household: solo se vacían las
 * tablas con datos de ESE household, nunca `households`/`householdMembers`/
 * `profiles`/`currencies`/`countries` ni las filas globales de catálogo.
 */
export async function wipeLocalHouseholdData(householdId: string): Promise<void> {
  const db = getDb();

  const txIds = await db.transactions.where("householdId").equals(householdId).primaryKeys();
  await db.transactionShares.where("transactionId").anyOf(txIds).delete();
  await db.transactionSplits.where("transactionId").anyOf(txIds).delete();
  await db.transactionTags.where("transactionId").anyOf(txIds).delete();

  await Promise.all([
    db.transactions.where("householdId").equals(householdId).delete(),
    db.settlements.where("householdId").equals(householdId).delete(),
    db.accounts.where("householdId").equals(householdId).delete(),
    db.categories.where("householdId").equals(householdId).delete(),
    db.tags.where("householdId").equals(householdId).delete(),
    db.payees.where("householdId").equals(householdId).delete(),
    db.budgets.where("householdId").equals(householdId).delete(),
    db.goals.where("householdId").equals(householdId).delete(),
    db.recurringRules.where("householdId").equals(householdId).delete(),
    db.categorizationRules.where("householdId").equals(householdId).delete(),
    db.householdFxPreferences.where("householdId").equals(householdId).delete(),
    // Clones del household únicamente — las filas globales (`householdId: null`)
    // del catálogo compartido no matchean `.equals(householdId)`.
    db.institutions.where("householdId").equals(householdId).delete(),
  ]);
}
