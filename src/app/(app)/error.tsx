"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, usePageHeader } from "@/design-system";

/**
 * Boundary de error dentro del shell autenticado. Next exige que sea
 * Client Component. `reset()` reintenta el render del segmento sin
 * recargar toda la app — primera opción, como pide `ErrorState`; "Volver
 * al inicio" como alternativa si el error persiste. Nunca un stack trace
 * visible (CLAUDE.md): eso va a `console.error`, no a la pantalla.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("errorPage.title") });

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
      <ErrorState
        what={t("errorPage.what")}
        next={t("errorPage.next")}
        onAlternative={() => router.push("/")}
        alternativeLabel={t("errorPage.goHome")}
        onRetry={reset}
        retryLabel={t("common.retry")}
      />
    </div>
  );
}
