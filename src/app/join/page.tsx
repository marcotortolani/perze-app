"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { invitesRepo } from "@/lib/repos/invites-repo";
import { hydrateFromRemote } from "@/lib/offline/hydrate";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { householdsRepo } from "@/lib/repos/households-repo";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { clearPendingInviteCode, getPendingInviteCode, setPendingInviteCode } from "@/lib/onboarding/pending-invite";

/** Solo las letras del alfabeto de `randomCode()` — lo pegado desde un
 *  chat suele traer espacios, comillas o un salto de línea. */
function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Aceptar una invitación (J3, el otro lado) — ruta hermana fuera de
 * `(app)/`: quien llega acá puede no tener household todavía, así que el
 * shell con tab bar no aplica (misma convención que `/add`, `/accounts/new`).
 *
 * Dos formas de llegar, y las dos tienen que funcionar:
 *
 * - **Con el link** que J3 copia (`/join?invite=XXX`): el código entra
 *   prellenado y solo queda confirmar. El parámetro NO se puede llamar
 *   `code`: `proxy.ts` intercepta cualquier URL con `?code=` como canje
 *   PKCE de Supabase y la manda a `/auth/callback` antes de que esta
 *   pantalla llegue a renderizar.
 * - **A mano**, desde "tengo un código de invitación" en A2, tipeando el
 *   código que le pasaron por otro lado.
 *
 * Si todavía no hay sesión no se puede canjear —`accept_invite` exige
 * `auth.uid()`—, así que el código se guarda y la pantalla manda a
 * registrarse; `resolveOnboardingDestination()` lo trae de vuelta acá
 * apenas hay cuenta, en vez de dejarlo crear un household propio.
 */
export default function JoinHouseholdPage() {
  return (
    <Suspense fallback={null}>
      <JoinHouseholdContent />
    </Suspense>
  );
}

function JoinHouseholdContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateHousehold = useInvalidateHousehold();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get("invite") ?? getPendingInviteCode() ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  // `null` mientras se resuelve: sin esto la pantalla parpadea entre
  // "unirme" y "creá tu cuenta" en el primer render.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setHasSession(!!data.user);
      })
      .catch(() => {
        if (!cancelled) setHasSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleJoin = async () => {
    if (!code || submitting) return;

    // Sin cuenta no hay canje posible: se guarda el código y se sigue por
    // el alta. El código sobrevive al viaje por el mail del magic link.
    if (hasSession === false) {
      setPendingInviteCode(code);
      router.push("/onboarding");
      return;
    }

    setSubmitting(true);
    setError(false);
    try {
      const householdId = await invitesRepo.accept(code);
      // AC-2 (`docs/auditoria-acceso.md`) — antes esto solo escribía
      // `meta.currentHouseholdId`: sin ninguna fila local del household
      // aceptado, `useCurrentHousehold` devolvía null y el invitado
      // rebotaba al onboarding sin llegar jamás a donde lo invitaron.
      // La hidratación scoped baja SOLO ese household (cuentas, categorías,
      // movimientos…) y lo deja activo, sin tocar el resto de la base local.
      await hydrateFromRemote({ householdId });
      // `hydrateFromRemote` solo baja los datos: sin esto, `getCurrentHouseholdId()`
      // (Dexie, `meta.currentHouseholdId`) sigue apuntando a lo que hubiera
      // antes —el household propio si ya se había pasado por A11— y
      // `useCurrentHousehold()` seguía mostrando ESE, nunca el que se
      // acaba de aceptar. Bug real: un invitado que ya tenía cuenta propia
      // veía "nada" del hogar del owner después de aceptar.
      await householdsRepo.setCurrentHouseholdId(householdId);
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (user) void profilesRepo.setDefaultHousehold(user.id, householdId).catch(() => {});
      clearPendingInviteCode();
      invalidateHousehold();
      toast(t("familyPage.joined"));
      router.push("/");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const needsAccount = hasSession === false;

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      {/* El wordmark ocupa el lugar donde antes había un ícono de personas:
          decorativo, y el presupuesto de ruido no los permite. Acá el logo
          sí va — es una pantalla de afuera de la app, como A2 y login. */}
      <Logo style={{ fontSize: "var(--text-title-size)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="t-title" style={{ margin: 0 }}>{t("familyPage.joinTitle")}</h1>
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {needsAccount ? t("familyPage.joinNeedsAccount") : t("familyPage.joinSubtitle")}
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 280 }}>
        <Input
          label={t("familyPage.enterCode")}
          placeholder="AB2CD3EFGHJ"
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            setError(false);
          }}
          invalid={error}
          hint={error ? t("familyPage.invalidCode") : undefined}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <Button disabled={!code || submitting} onClick={handleJoin} style={{ maxWidth: 280 }}>
        {needsAccount ? t("familyPage.joinCreateAccount") : t("familyPage.join")}
      </Button>
    </ScreenShell>
  );
}
