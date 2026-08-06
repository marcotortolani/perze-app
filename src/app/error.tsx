"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";

/**
 * Boundary de error raíz — para lo que rompa fuera de `(app)/`
 * (onboarding, `/join`, `/about`, etc). `(app)/error.tsx` atiende lo que
 * rompe adentro del shell autenticado; este es el genérico para todo lo
 * demás. Sigue montado dentro de `IntlBoundary`/`Providers`
 * (`src/app/layout.tsx`): esos viven en el layout, por encima del punto
 * donde Next inserta este boundary, así que `useTranslations` funciona
 * acá con normalidad. Si el error viniera del layout raíz mismo (Providers
 * incluido), cae a `global-error.tsx`, sin ese contexto.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20 }}>
      <Logo size={20} />
      <ErrorState
        what={t("errorPage.what")}
        next={t("errorPage.next")}
        onAlternative={() => router.push("/")}
        alternativeLabel={t("errorPage.goHome")}
        onRetry={reset}
        retryLabel={t("common.retry")}
      />
    </ScreenShell>
  );
}
