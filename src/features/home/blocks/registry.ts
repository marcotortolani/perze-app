import type { ComponentType } from "react";
import type { HomeDataReady } from "../home-data";
import { NetWorthBlock } from "./NetWorthBlock";
import { InvestingBlock } from "./InvestingBlock";
import { AccountsBlock } from "./AccountsBlock";
import { CreditCardsBlock } from "./CreditCardsBlock";
import { PeriodTotalsBlock } from "./PeriodTotalsBlock";
import { InsightBlock } from "./InsightBlock";
import { RecentTransactionsBlock } from "./RecentTransactionsBlock";

export type HomeBlockId =
  | "net-worth"
  | "investing"
  | "accounts"
  | "credit-cards"
  | "period-totals"
  | "insight"
  | "recent-transactions";

export interface HomeBlockDef {
  id: HomeBlockId;
  /**
   * Clave de `home.customize.blocks.<id>` — nombre del bloque en el modo
   * edición. Template-literal, no `string`: así tipa contra la unión
   * exacta de claves de next-intl (`global.ts`), mismo criterio que
   * `ACCOUNT_KIND_MESSAGE_KEY`.
   */
  labelKey: `home.customize.blocks.${HomeBlockId}`;
  Component: ComponentType;
  /**
   * Si el bloque tiene algo que mostrar ahora mismo. NUNCA decide si el
   * bloque sigue existiendo en el layout guardado — eso lo resuelve
   * `resolveHomeLayout` (Paso 2), que preserva la posición del bloque
   * aunque hoy no esté disponible, para que un módulo que se reactiva (o
   * una condición que vuelve a cumplirse) recupere su lugar en vez de
   * caer al final.
   */
  isAvailable: (data: HomeDataReady) => boolean;
}

/**
 * Layout de hoy, hardcodeado — es el que ya vivía en `page.tsx` antes de
 * este refactor. `HomeBlocksLayout` lo usa tal cual mientras no exista el
 * modo de reordenamiento (Paso 2 en adelante lo reemplaza por el layout
 * resuelto desde `resolveHomeLayout`).
 */
export const DEFAULT_LEFT_COLUMN: HomeBlockId[] = ["net-worth", "investing", "accounts", "credit-cards"];
export const DEFAULT_RIGHT_COLUMN: HomeBlockId[] = ["period-totals", "insight", "recent-transactions"];

export const HOME_BLOCK_REGISTRY: Record<HomeBlockId, HomeBlockDef> = {
  "net-worth": {
    id: "net-worth",
    labelKey: "home.customize.blocks.net-worth",
    Component: NetWorthBlock,
    isAvailable: () => true,
  },
  investing: {
    id: "investing",
    labelKey: "home.customize.blocks.investing",
    Component: InvestingBlock,
    isAvailable: (data) => data.investmentsEnabled && !!data.investmentsTrend.data?.hasPositions,
  },
  accounts: {
    id: "accounts",
    labelKey: "home.customize.blocks.accounts",
    Component: AccountsBlock,
    isAvailable: () => true,
  },
  "credit-cards": {
    id: "credit-cards",
    labelKey: "home.customize.blocks.credit-cards",
    Component: CreditCardsBlock,
    isAvailable: (data) => data.creditCardAccounts.length > 0,
  },
  "period-totals": {
    id: "period-totals",
    labelKey: "home.customize.blocks.period-totals",
    Component: PeriodTotalsBlock,
    isAvailable: () => true,
  },
  insight: {
    id: "insight",
    labelKey: "home.customize.blocks.insight",
    Component: InsightBlock,
    isAvailable: (data) => data.budgetAlerts.length > 0 || data.needsFxCount > 0 || !!data.topCategory,
  },
  "recent-transactions": {
    id: "recent-transactions",
    labelKey: "home.customize.blocks.recent-transactions",
    Component: RecentTransactionsBlock,
    isAvailable: () => true,
  },
};

/** Config para `resolveHomeLayout`/`layout-actions` — un solo lugar que enumera el catálogo completo. */
export const HOME_LAYOUT_CATALOG = {
  catalog: [...DEFAULT_LEFT_COLUMN, ...DEFAULT_RIGHT_COLUMN],
  defaultLeft: DEFAULT_LEFT_COLUMN,
  defaultRight: DEFAULT_RIGHT_COLUMN,
};
