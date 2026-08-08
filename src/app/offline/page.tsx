"use client";

import { useTranslations } from "next-intl";
import { Button, Icon } from "@/design-system";

/**
 * Fallback offline del service worker (`src/app/sw.ts`) — se muestra cuando
 * se navega a una ruta que todavía no está en caché y no hay red. La app en
 * sí es local-first (Dexie): cualquier pantalla ya visitada sigue andando
 * sin conexión.
 *
 * No es una pantalla de error muda a propósito. Quien llega acá con la PWA
 * instalada casi siempre venía a hacer una sola cosa —cargar un gasto— y
 * eso **sí se puede hacer sin conexión**: `/add` está precacheada y guarda
 * en Dexie. Dejar solo un mensaje convertía el caso más importante del
 * producto en un callejón sin salida.
 *
 * Por eso la acción primaria es cargar un movimiento y no "recargar":
 * recargar es lo que la persona haría sola, y la métrica del producto es
 * cargar un gasto en menos de 5 segundos. La caption de abajo del botón es
 * el único lugar donde el aviso de "queda en cola" va ANTES de guardar —
 * acá hace falta para que el botón sea creíble; dentro de la captura ese
 * aviso ya lo da el toast `capture.savedOffline`, después del hecho, que es
 * el momento honesto.
 *
 * `window.location.href` y no `router.push`: una navegación blanda pediría
 * el payload RSC de `/add`, que sin red pasa por el `NetworkFirst` con
 * timeout de 3 segundos antes de caer al fallback MPA. La navegación dura
 * pega directo contra `PrecacheRoute`, que se registra antes que todo el
 * `runtimeCaching`, así que responde al toque.
 */
export default function OfflinePage() {
  const t = useTranslations();

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
      {/* El ícono no es decorativo: es lo único que porta el estado. */}
      <Icon name="wifi" size={32} strokeWidth={1.25} color="var(--text-muted)" />
      <h1 className="t-title" style={{ margin: 0 }}>
        {t("offlinePage.title")}
      </h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: "var(--text-secondary)", maxWidth: "28ch" }}>{t("offlinePage.message")}</p>

      <div style={{ marginTop: "auto", width: "100%", maxWidth: "var(--content-max-width)", display: "flex", flexDirection: "column", gap: 12 }}>
        <Button size="lg" onClick={() => (window.location.href = "/add")}>
          {t("offlinePage.addTransaction")}
        </Button>
        <p className="t-caption" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t("offlinePage.queueNotice")}
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t("offlinePage.reload")}
        </Button>
      </div>
    </div>
  );
}
