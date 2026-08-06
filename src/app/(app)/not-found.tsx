"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, usePageHeader } from "@/design-system";

/**
 * 404 dentro del shell autenticado — Next monta esto (en vez del genérico
 * de `src/app/not-found.tsx`) cuando la ruta que no existe cuelga de
 * `(app)/`: sidebar/tab bar ya están montados por `AppShellLayout` y una
 * navegación de cliente a un path roto solo reemplaza el contenido, nunca
 * el layout — sin este archivo, ese contenido caía al 404 default de
 * Next, sin ningún token de marca.
 *
 * `EmptyState` ya trae el `ZMark` de marca — mismo criterio que cualquier
 * lista vacía de la app (CLAUDE.md § auditoría: "el patrón es ZMark al
 * 20%, no un ícono de línea").
 */
export default function NotFound() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("notFoundPage.title") });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
      <EmptyState message={t("notFoundPage.message")} actionLabel={t("notFoundPage.action")} onAction={() => router.push("/")} />
    </div>
  );
}
