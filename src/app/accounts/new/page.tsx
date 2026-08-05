"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useInvalidateAccounts } from "@/hooks/use-accounts";

/**
 * E3 — crear cuenta. Ruta de página completa, mismo patrón que `/add`; es
 * el destino de un deep link (shortcut, link externo), no solo de la
 * navegación blanda que intercepta `@modal/(.)accounts/new`.
 *
 * `userId` es tri-estado (`useEffectiveUserId`): `undefined` mientras la
 * sesión todavía no resolvió, `null` cuando ya se sabe que no hay sesión.
 * Antes los dos casos pintaban la misma pantalla en blanco — el segundo se
 * quedaba así para siempre en vez de mandar a loguearse.
 */
export default function NewAccountPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const invalidateAccounts = useInvalidateAccounts(household?.id);

  useEffect(() => {
    if (userId === null) router.replace("/login");
  }, [userId, router]);

  if (userId === null) return null;

  if (!household || !userId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "var(--screen-padding)" }}>
        <Skeleton width={120} height={24} />
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <AccountFormFlow
      householdId={household.id}
      userId={userId}
      onClose={() => router.push("/accounts")}
      onSaved={(account) => {
        invalidateAccounts();
        router.push(`/accounts?account=${account.id}`);
      }}
    />
  );
}
