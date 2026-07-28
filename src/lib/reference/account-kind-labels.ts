import type { AccountKind } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";

/**
 * `AccountKind` → clave de `reference.accountKind.*` — mismo patrón que
 * `CATEGORY_MESSAGE_KEY` (ver `reference/category-i18n.ts`): un objeto
 * literal, no un template dinámico, para que tipe contra la unión exacta
 * de claves de next-intl.
 */
export const ACCOUNT_KIND_MESSAGE_KEY = {
  cash: "reference.accountKind.cash",
  checking: "reference.accountKind.checking",
  savings: "reference.accountKind.savings",
  credit_card: "reference.accountKind.credit_card",
  wallet: "reference.accountKind.wallet",
  broker: "reference.accountKind.broker",
  loan: "reference.accountKind.loan",
  receivable: "reference.accountKind.receivable",
  other: "reference.accountKind.other",
} as const satisfies Record<AccountKind, string>;

/** @deprecated Solo para callers no migrados a next-intl todavía — usar `ACCOUNT_KIND_MESSAGE_KEY` con `useTranslations`. */
export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  cash: "Efectivo",
  checking: "Cuenta corriente",
  savings: "Caja de ahorro",
  credit_card: "Tarjeta de crédito",
  wallet: "Billetera digital",
  broker: "Cuenta de inversión",
  loan: "Préstamo",
  receivable: "Por cobrar",
  other: "Otra cuenta",
};

/** Un glifo por tipo de cuenta — antes "checking" y "savings" compartían `bank`. */
export const ACCOUNT_KIND_ICON: Record<AccountKind, IconName> = {
  cash: "banknote",
  checking: "bank",
  savings: "piggy-bank",
  credit_card: "credit-card",
  wallet: "wallet",
  broker: "invest",
  loan: "handshake",
  receivable: "hand-coins",
  other: "wallet",
};
