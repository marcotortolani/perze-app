export interface MoneyFlowTransaction {
  kind: "income" | "expense" | "transfer" | "adjustment" | "investing";
  accountId: string;
  categoryId: string | null;
  amountBase: bigint | null;
}

export interface MoneyFlowNode {
  id: string;
  label: string;
  column: 0 | 1 | 2;
}

export interface MoneyFlowLink {
  source: string;
  target: string;
  value: number;
}

export interface MoneyFlowResult {
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
  excludedCount: number;
}

const MAX_CATEGORIES_PER_SIDE = 5;

/**
 * H4 — Sankey ingresos → cuentas → destinos. Solo `income`/`expense` con
 * `amountBase` resuelto entran al flujo (needs_fx no se puede convertir a
 * una unidad común, así que sumarlo daría un número sin significado — el
 * conteo excluido se devuelve aparte, nunca el monto).
 */
export function computeMoneyFlow(
  transactions: MoneyFlowTransaction[],
  labels: { categoryLabel: (id: string) => string; accountLabel: (id: string) => string; otherIncome: string; otherExpense: string }
): MoneyFlowResult {
  let excludedCount = 0;
  const incomeByCategory = new Map<string, Map<string, bigint>>(); // category -> account -> value
  const expenseByCategory = new Map<string, Map<string, bigint>>(); // account -> category -> value

  for (const tx of transactions) {
    if (tx.kind !== "income" && tx.kind !== "expense") continue;
    if (tx.amountBase === null) {
      excludedCount++;
      continue;
    }
    const categoryKey = tx.categoryId ?? "__none";
    if (tx.kind === "income") {
      const byAccount = incomeByCategory.get(categoryKey) ?? new Map<string, bigint>();
      byAccount.set(tx.accountId, (byAccount.get(tx.accountId) ?? 0n) + tx.amountBase);
      incomeByCategory.set(categoryKey, byAccount);
    } else {
      const byCategory = expenseByCategory.get(tx.accountId) ?? new Map<string, bigint>();
      byCategory.set(categoryKey, (byCategory.get(categoryKey) ?? 0n) + tx.amountBase);
      expenseByCategory.set(tx.accountId, byCategory);
    }
  }

  const topCategories = (totalsByCategory: Map<string, bigint>, otherLabel: string): { keep: Set<string>; otherKey: string | null } => {
    const sorted = [...totalsByCategory.entries()].sort((a, b) => (b[1] > a[1] ? 1 : a[1] > b[1] ? -1 : 0));
    if (sorted.length <= MAX_CATEGORIES_PER_SIDE) return { keep: new Set(sorted.map(([k]) => k)), otherKey: null };
    return { keep: new Set(sorted.slice(0, MAX_CATEGORIES_PER_SIDE).map(([k]) => k)), otherKey: otherLabel };
  };

  const incomeCategoryTotals = new Map<string, bigint>();
  for (const [category, byAccount] of incomeByCategory) {
    incomeCategoryTotals.set(category, [...byAccount.values()].reduce((s, v) => s + v, 0n));
  }
  const { keep: keepIncome } = topCategories(incomeCategoryTotals, "__other_income");

  const expenseCategoryTotals = new Map<string, bigint>();
  for (const byCategory of expenseByCategory.values()) {
    for (const [category, value] of byCategory) {
      expenseCategoryTotals.set(category, (expenseCategoryTotals.get(category) ?? 0n) + value);
    }
  }
  const { keep: keepExpense } = topCategories(expenseCategoryTotals, "__other_expense");

  const nodes = new Map<string, MoneyFlowNode>();
  const links: MoneyFlowLink[] = [];
  const accountIds = new Set<string>();

  const incomeNodeId = (category: string) => (keepIncome.has(category) ? `income:${category}` : "income:__other");
  const expenseNodeId = (category: string) => (keepExpense.has(category) ? `expense:${category}` : "expense:__other");

  for (const [category, byAccount] of incomeByCategory) {
    const nodeId = incomeNodeId(category);
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, { id: nodeId, label: keepIncome.has(category) ? (category === "__none" ? labels.otherIncome : labels.categoryLabel(category)) : labels.otherIncome, column: 0 });
    }
    for (const [accountId, value] of byAccount) {
      accountIds.add(accountId);
      links.push({ source: nodeId, target: `account:${accountId}`, value: Number(value) });
    }
  }

  for (const [accountId, byCategory] of expenseByCategory) {
    accountIds.add(accountId);
    for (const [category, value] of byCategory) {
      const nodeId = expenseNodeId(category);
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, { id: nodeId, label: keepExpense.has(category) ? (category === "__none" ? labels.otherExpense : labels.categoryLabel(category)) : labels.otherExpense, column: 2 });
      }
      links.push({ source: `account:${accountId}`, target: nodeId, value: Number(value) });
    }
  }

  for (const accountId of accountIds) {
    nodes.set(`account:${accountId}`, { id: `account:${accountId}`, label: labels.accountLabel(accountId), column: 1 });
  }

  // Consolida los links duplicados que caen en el mismo par origen→destino
  // (varias categorías reales colapsadas al mismo nodo "Otros").
  const mergedLinks = new Map<string, MoneyFlowLink>();
  for (const link of links) {
    const key = `${link.source}->${link.target}`;
    const existing = mergedLinks.get(key);
    if (existing) existing.value += link.value;
    else mergedLinks.set(key, { ...link });
  }

  return { nodes: [...nodes.values()], links: [...mergedLinks.values()], excludedCount };
}
