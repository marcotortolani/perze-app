"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useCurrentUserId } from "@/hooks/use-current-user";

/** E3 — editar cuenta. Ruta de página completa, mismo patrón que `/transactions/[id]/editar`. */
export default function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: account, isLoading } = useAccount(id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  if (isLoading || !household) return null;
  if (!account) return <EmptyState message={t("accountsPage.reconcile.notFound")} actionLabel={t("accountsPage.reconcile.back")} onAction={() => router.push("/accounts")} />;

  return (
    <AccountFormFlow
      householdId={household.id}
      userId={userId}
      existing={account}
      onClose={() => router.push(`/accounts/${id}`)}
      onSaved={() => {
        invalidateAccounts();
        router.push(`/accounts/${id}`);
      }}
    />
  );
}
