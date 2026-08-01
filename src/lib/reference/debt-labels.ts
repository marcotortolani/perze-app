import type { DebtKind } from "@/lib/repos/debts-repo";

/** `DebtKind` → clave de `reference.debtKind.*` — mismo patrón que `ACCOUNT_KIND_MESSAGE_KEY`. */
export const DEBT_KIND_MESSAGE_KEY = {
  installment_plan: "reference.debtKind.installment_plan",
  loan: "reference.debtKind.loan",
  credit_line: "reference.debtKind.credit_line",
  personal: "reference.debtKind.personal",
} as const satisfies Record<DebtKind, string>;
