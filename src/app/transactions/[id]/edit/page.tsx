"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { EditTransactionFlow } from "@/features/movements/EditTransactionFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTransaction } from "@/hooks/use-transactions";
import { useTrade } from "@/hooks/use-investments";

/** D4 — editar movimiento. Ruta de página completa, mismo patrón que `/add`. */
export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transaction, isLoading } = useTransaction(id);
  // `investing` (settlement de un trade) no tiene entrada real a esta
  // ruta — ni el "Editar" del detalle ni el swipe-right de la lista la
  // ofrecen para este kind — pero un link viejo (bookmark, notificación)
  // sigue pudiendo apuntar acá. Nunca auto-redirigir con `replace`
  // (`navigation-uses-replace.test.ts` lo prohíbe para este archivo, y
  // con razón: un back-trap si el usuario vuelve desde el destino) — un
  // link manual alcanza para el caso raro.
  const { data: linkedTrade } = useTrade(transaction?.kind === "investing" ? transaction.tradeId : undefined);

  if (isLoading || !household) return null;
  if (!transaction) return <EmptyState message={t("transactions.edit.notFound")} actionLabel={t("transactions.edit.back")} onAction={() => router.push("/transactions")} />;
  if (transaction.kind === "investing") {
    return (
      <EmptyState
        message={t("transactions.detail.investingManagedElsewhere")}
        actionLabel={linkedTrade ? t("transactions.detail.viewInInvestments") : undefined}
        onAction={linkedTrade ? () => router.push(`/investments/${linkedTrade.portfolioId}?position=${linkedTrade.instrumentId}`) : undefined}
      />
    );
  }

  return (
    <EditTransactionFlow
      transaction={transaction}
      household={household}
      accounts={accounts}
      categories={categories}
      // `back()`, no `replace`/`push` — se llega acá con push desde el
      // detalle o desde un swipe-right en una lista, que ya está en el
      // historial justo debajo en los dos casos; `onClose` dispara tanto
      // al cancelar como al guardar (ver `EditTransactionFlow.tsx`).
      // `replace("/transactions")` no solo duplicaba la entrada — también
      // mandaba siempre a la lista aunque se hubiera entrado desde el
      // detalle de un movimiento puntual. `back()` vuelve a donde
      // realmente se estaba.
      onClose={() => router.back()}
    />
  );
}
