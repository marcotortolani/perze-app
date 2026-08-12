"use client";

import { useMemo } from "react";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";
import type { TransactionFilters } from "@/lib/repos/transactions-repo";
import { useScopeStore } from "@/stores/scope-store";
import { accountMatchesScope } from "@/lib/scope/match-scope";
import { useAccounts } from "./use-accounts";
import { useTransactions } from "./use-transactions";

/**
 * El switch Personal/Compartido/Todo del header filtra `accounts` por
 * `visibility` (`accountMatchesScope`) y de ahí a `transactions`, por cuenta
 * o cuenta contraparte (transferencias). Estaba copiado en dos lugares
 * (`TransactionsListContent`, `/transactions/history`) y **faltaba en el
 * heatmap del calendario** — un movimiento cuya cuenta ya no matchea el
 * scope activo pintaba el día en el calendario pero no aparecía en la
 * lista al tocarlo, indistinguible de "actividad fantasma" de un caché
 * desincronizado. Un solo dueño para las tres puntas, para que eso sea
 * estructuralmente imposible.
 */
export function useScopedAccounts(householdId: string | undefined) {
  const { data: accountsRaw = [], isLoading } = useAccounts(householdId);
  const scope = useScopeStore((s) => s.scope);
  const accounts = useMemo(() => accountsRaw.filter((a: AccountRow) => accountMatchesScope(a.visibility, scope)), [accountsRaw, scope]);
  const accountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  return { accounts, accountIds, isLoading };
}

/**
 * `useTransactions` acotado al scope activo. Devuelve el mismo shape que
 * `useQuery` (`data`/`isLoading`/etc.) para poder reemplazar `useTransactions`
 * uno a uno donde el consumidor ya filtraba por cuenta a mano.
 */
export function useScopedTransactions(householdId: string | undefined, filters: TransactionFilters = {}) {
  const transactionsQuery = useTransactions(householdId, filters);
  const { accountIds } = useScopedAccounts(householdId);
  const transactions = useMemo(
    () => (transactionsQuery.data ?? []).filter((tx: TransactionRow) => accountIds.has(tx.accountId) || (tx.counterAccountId !== null && accountIds.has(tx.counterAccountId))),
    [transactionsQuery.data, accountIds]
  );
  return { ...transactionsQuery, data: transactions };
}
