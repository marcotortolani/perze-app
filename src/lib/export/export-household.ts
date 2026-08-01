import { getDb } from "../db/client";
import { APP_VERSION } from "../version";

/**
 * K10 — backup completo en JSON de lo que vive local-first (Dexie). Deja
 * afuera lo que vive solo en Supabase (invites, visibility_grants,
 * settlements, mirror mode, todo el módulo de inversiones): es dato
 * cross-member/de bajo volumen, no la fuente de verdad de "tus datos son
 * tuyos" que persigue esta pantalla — se documenta en el propio export.
 */
export interface HouseholdExportCounts {
  accounts: number;
  categories: number;
  tags: number;
  payees: number;
  transactions: number;
  budgets: number;
  goals: number;
  recurringRules: number;
}

export async function countHouseholdExport(householdId: string): Promise<HouseholdExportCounts> {
  const db = getDb();
  const [accounts, categories, tags, payees, transactions, budgets, goals, recurringRules] = await Promise.all([
    db.accounts.where("householdId").equals(householdId).count(),
    db.categories.where("householdId").equals(householdId).count(),
    db.tags.where("householdId").equals(householdId).count(),
    db.payees.where("householdId").equals(householdId).count(),
    db.transactions.where("householdId").equals(householdId).count(),
    db.budgets.where("householdId").equals(householdId).count(),
    db.goals.where("householdId").equals(householdId).count(),
    db.recurringRules.where("householdId").equals(householdId).count(),
  ]);
  return { accounts, categories, tags, payees, transactions, budgets, goals, recurringRules };
}

export async function buildHouseholdExport(householdId: string) {
  const db = getDb();
  const household = await db.households.get(householdId);
  const [accounts, categories, tags, payees, transactions, budgets, goals, recurringRules] = await Promise.all([
    db.accounts.where("householdId").equals(householdId).toArray(),
    db.categories.where("householdId").equals(householdId).toArray(),
    db.tags.where("householdId").equals(householdId).toArray(),
    db.payees.where("householdId").equals(householdId).toArray(),
    db.transactions.where("householdId").equals(householdId).toArray(),
    db.budgets.where("householdId").equals(householdId).toArray(),
    db.goals.where("householdId").equals(householdId).toArray(),
    db.recurringRules.where("householdId").equals(householdId).toArray(),
  ]);
  const transactionIds = new Set(transactions.map((tx) => tx.id));
  const [transactionTags, transactionSplits, transactionShares] = await Promise.all([
    db.transactionTags.toArray().then((rows) => rows.filter((r) => transactionIds.has(r.transactionId))),
    db.transactionSplits.toArray().then((rows) => rows.filter((r) => transactionIds.has(r.transactionId))),
    db.transactionShares.toArray().then((rows) => rows.filter((r) => transactionIds.has(r.transactionId))),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    formatVersion: 1,
    household,
    accounts,
    categories,
    tags,
    payees,
    transactions,
    transactionTags,
    transactionSplits,
    transactionShares,
    budgets,
    goals,
    recurringRules,
  };
}

/** `bigint` (montos) no serializa con `JSON.stringify` sin este reemplazo — nunca por `Number()`. */
export function stringifyHouseholdExport(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2);
}
