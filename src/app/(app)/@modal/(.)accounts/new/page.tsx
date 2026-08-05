"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { AccountFormFlow } from "@/features/accounts/AccountFormFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useInvalidateAccounts } from "@/hooks/use-accounts";

/**
 * Intercepta `/accounts/new` en navegación blanda desde dentro de
 * `/accounts`, para que crear una cuenta se dibuje como modal encima de la
 * lista en vez de reemplazar la pantalla. Mismo patrón que `@modal/(.)add`:
 * `router.back()` en vez de `router.push`, para no re-fetchear la lista de
 * abajo al cerrar.
 *
 * (Antes esta nota explicaba además que sin este archivo el interceptor
 * `accounts/@detail/(.)[id]` reclamaba "new" como si fuera un id de cuenta.
 * Ese interceptor ya no existe: el detalle de cuenta pasó a ser un search
 * param, ver `(app)/accounts/page.tsx`.)
 */
export default function InterceptedNewAccountPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  // `useEffectiveUserId`: con el hook crudo, `userId` queda en `null` para
  // siempre en modo demo (nunca hay sesión de Supabase) y el `return null`
  // de abajo deja el modal VACÍO — se abre la URL y no se dibuja nada.
  const userId = useEffectiveUserId();
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
          router.replace(`/accounts?account=${account.id}`);
        }}
      />
    </Modal>
  );
}
