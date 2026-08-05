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

/** D4 — editar movimiento. Ruta de página completa, mismo patrón que `/add`. */
export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transaction, isLoading } = useTransaction(id);

  if (isLoading || !household) return null;
  if (!transaction) return <EmptyState message={t("transactions.edit.notFound")} actionLabel={t("transactions.edit.back")} onAction={() => router.push("/transactions")} />;

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
