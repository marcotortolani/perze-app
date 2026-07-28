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
  if (!transaction) return <EmptyState icon="alert" message={t("transactions.edit.notFound")} actionLabel={t("transactions.edit.back")} onAction={() => router.push("/transactions")} />;

  return (
    <EditTransactionFlow
      transaction={transaction}
      household={household}
      accounts={accounts}
      categories={categories}
      onClose={() => router.push("/transactions")}
    />
  );
}
