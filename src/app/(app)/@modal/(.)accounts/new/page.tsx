"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useInvalidateAccounts } from "@/hooks/use-accounts";

/**
 * Intercepta `/accounts/new` en navegación blanda desde dentro de
 * `/accounts` — sin este archivo, `accounts/@detail/(.)[id]` se queda con
 * el push y trata "new" como si fuera un id de cuenta (ver la guarda en
 * `accounts/@detail/new/page.tsx`). Mismo patrón que `@modal/(.)add`:
 * `router.back()` en vez de `router.push`, para no re-fetchear la lista de
 * abajo al cerrar.
 */
export default function InterceptedNewAccountPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  if (!household || !userId) return null;

  return (
    <Modal>
      <AccountFormFlow
        householdId={household.id}
        userId={userId}
        onClose={() => router.back()}
        onSaved={(account) => {
          invalidateAccounts();
          router.replace(`/accounts/${account.id}`);
        }}
      />
    </Modal>
  );
}
