"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SectionGroup, TransactionRow } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { SwipeableRow } from "@/features/movements/SwipeableRow";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { usePrivacyStore } from "@/stores/privacy-store";
import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";
import { useHomeData } from "../home-data";

export function RecentTransactionsBlock() {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { recentTransactions, accountById, categoryById, tagNamesByTx, isCardPayment, baseCurrency, deleteTransaction } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);

  return (
    <SectionGroup label={t("home.recentTransactions")} onSeeAll={() => router.push("/transactions")} seeAllLabel={t("common.seeAll")}>
      <div>
        {recentTransactions.map((tx: TransactionRecord) => {
          const account = accountById.get(tx.accountId);
          const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
          const cardPayment = isCardPayment(tx);
          const reconciliation = tx.kind === "adjustment";
          // Mismo criterio que `/transactions`: el ícono + el título ya
          // muestran la categoría, repetirla acá es redundante — si el
          // movimiento tiene etiquetas, se muestran ELLAS en su lugar.
          const tagNames = tagNamesByTx.get(tx.id) ?? [];
          const categoryOrTransfer = category
            ? categoryLabel(category)
            : tx.kind === "investing"
              ? (tx.note ?? t("transactions.list.investing"))
              : reconciliation
                ? t("home.reconciliation")
                : cardPayment
                  ? t("home.cardPayment")
                  : tx.kind === "transfer"
                    ? t("home.transfer")
                    : undefined;
          const meta = tx.kind === "investing" ? (account?.name ?? "") : [account?.name, tagNames.length > 0 ? tagNames.join(", ") : categoryOrTransfer].filter(Boolean).join(" · ");
          const polarity = tx.kind === "income" ? "positive" : tx.kind === "transfer" || reconciliation || tx.kind === "investing" ? "neutral" : "negative";
          const secondary = tx.currencyCode !== baseCurrency && tx.amountBase !== null ? formatAmountCompact(money(tx.amountBase, baseCurrency), { showSign: false }) : undefined;
          return (
            <SwipeableRow
              key={tx.id}
              // `investing`: ni editar ni borrar suceden acá — las dos
              // viven en Inversiones, sobre el trade (mismo criterio que
              // `/transactions`).
              onSwipeRightCommit={tx.kind === "investing" ? undefined : () => router.push(`/transactions/${tx.id}/edit`)}
              onSwipeLeftCommit={tx.kind === "investing" ? undefined : () => deleteTransaction(tx.id)}
              confirmLabel={t("transactions.list.confirmDelete")}
              confirmActionLabel={t("transactions.list.confirmDeleteAction")}
            >
              <TransactionRow
                icon={(category?.icon as IconName) ?? (tx.kind === "investing" ? "trend" : reconciliation ? "circle-half-tilt" : cardPayment ? "credit-card" : tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={categoryOrTransfer ?? t("home.movement")}
                meta={meta || undefined}
                value={money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode)}
                secondary={secondary}
                polarity={polarity}
                privacy={privacy}
                syncIssue={tx.syncState === "ok" ? undefined : tx.syncState}
                onClick={() => router.push(`/transactions?tx=${tx.id}`)}
              />
            </SwipeableRow>
          );
        })}
      </div>
    </SectionGroup>
  );
}
