import { getTranslations } from "next-intl/server";
import { Icon } from "@/design-system";

/**
 * Fallback offline del service worker (`src/app/sw.ts`) — se muestra solo
 * cuando el usuario navega a una ruta que todavía no está en caché y no hay
 * red. La app en sí es local-first (Dexie): cualquier pantalla ya visitada
 * sigue andando sin conexión, esto es solo la red de contención para una
 * navegación nueva.
 */
export default async function OfflinePage() {
  const t = await getTranslations();
  return (
    <div
      style={{
        minHeight: "100svh",
        background: "var(--page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "calc(var(--screen-padding) + var(--safe-top)) var(--screen-padding) var(--screen-padding)",
        textAlign: "center",
      }}
    >
      <Icon name="wifi" size={32} strokeWidth={1.25} color="var(--text-muted)" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: "var(--text-secondary)", maxWidth: "28ch" }}>
        {t("offlinePage.message")}
      </p>
    </div>
  );
}
