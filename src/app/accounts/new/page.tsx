"use client";

import { useRouter } from "next/navigation";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useInvalidateAccounts } from "@/hooks/use-accounts";

/** E3 — crear cuenta. Ruta de página completa, mismo patrón que `/add`. */
export default function NewAccountPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  if (!household || !userId) return null;

  return (
    <AccountFormFlow
      householdId={household.id}
      userId={userId}
      onClose={() => router.push("/accounts")}
      onSaved={(account) => {
        invalidateAccounts();
        router.push(`/accounts/${account.id}`);
      }}
    />
  );
}
