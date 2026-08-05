"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useEffectiveUserId } from "@/hooks/use-current-user";

/** E3 — editar cuenta. Ruta de página completa, mismo patrón que `/transactions/[id]/editar`. */
export default function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: account, isLoading } = useAccount(id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  if (isLoading || !household || !userId) return null;
  if (!account) return <EmptyState message={t("accountsPage.reconcile.notFound")} actionLabel={t("accountsPage.reconcile.back")} onAction={() => router.push("/accounts")} />;

  return (
    <AccountFormFlow
      householdId={household.id}
      userId={userId}
      existing={account}
      // `back()`, no `replace`/`push` — se llega acá con push desde el
      // detalle, que ya está en el historial justo debajo, tanto
      // cancelando como guardando. `replace` a esa MISMA url duplicaba la
      // entrada (`[detalle, detalle]`) y "volver" necesitaba dos toques.
      onClose={() => router.back()}
      onSaved={() => {
        invalidateAccounts();
        router.back();
      }}
    />
  );
}
