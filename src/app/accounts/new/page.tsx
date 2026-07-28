"use client";

import { useRouter } from "next/navigation";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidateAccounts } from "@/hooks/use-accounts";
import { DEMO_USER_ID } from "@/lib/demo-user";

/** E3 — crear cuenta. Ruta de página completa, mismo patrón que `/add`. */
export default function NewAccountPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  if (!household) return null;

  return (
    <AccountFormFlow
      householdId={household.id}
      userId={DEMO_USER_ID}
      onClose={() => router.push("/accounts")}
      onSaved={(account) => {
        invalidateAccounts();
        router.push(`/accounts/${account.id}`);
      }}
    />
  );
}
