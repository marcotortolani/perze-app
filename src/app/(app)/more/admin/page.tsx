"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Input, ListRow, SegmentedControl, Sheet, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { adminRepo } from "@/lib/repos/admin-repo";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { useOwnAccess } from "@/hooks/use-own-access";
import { APP_VERSION } from "@/lib/version";

const METRICS_KEY = ["admin", "metrics"] as const;

// D35 — "Generar anuncio" es un único disparador de push broadcast (`kind:
// "app_update"`, la misma columna de preferencia `app_updates` para las
// cuatro), no cuatro. El "tipo" solo elige el título y el mensaje por
// defecto que se manda — no crea una categoría nueva de notificación_
// preferences ni toca `send-push`, que ya está cerrado a `is_app_admin`
// para este `kind`. Agregar un tipo acá es un cambio de una línea en cada
// uno de los tres Record de abajo, nunca en la Edge Function.
const ANNOUNCEMENT_TYPES = ["newVersion", "newFeature", "newModule", "other"] as const;
type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

const ANNOUNCEMENT_TYPE_LABEL_KEY: Record<AnnouncementType, string> = {
  newVersion: "adminPage.appUpdateBroadcast.types.newVersion",
  newFeature: "adminPage.appUpdateBroadcast.types.newFeature",
  newModule: "adminPage.appUpdateBroadcast.types.newModule",
  other: "adminPage.appUpdateBroadcast.types.other",
};

const ANNOUNCEMENT_TITLE_KEY: Record<AnnouncementType, string> = {
  newVersion: "adminPage.appUpdateBroadcast.titles.newVersion",
  newFeature: "adminPage.appUpdateBroadcast.titles.newFeature",
  newModule: "adminPage.appUpdateBroadcast.titles.newModule",
  other: "adminPage.appUpdateBroadcast.titles.other",
};

const ANNOUNCEMENT_DEFAULT_BODY_KEY: Record<AnnouncementType, string> = {
  newVersion: "adminPage.appUpdateBroadcast.defaultBodies.newVersion",
  newFeature: "adminPage.appUpdateBroadcast.defaultBodies.newFeature",
  newModule: "adminPage.appUpdateBroadcast.defaultBodies.newModule",
  other: "adminPage.appUpdateBroadcast.defaultBodies.other",
};

/**
 * Panel del operador (§3.3) — pantalla nueva, fuera de `enabled_modules`
 * (no es un módulo opcional del producto, es de la instancia entera).
 * Gateado dos veces: `src/app/(app)/more/page.tsx` solo dibuja la entrada
 * si `is_app_admin`, y las tres RPC de `adminRepo` rechazan a cualquiera
 * que no lo sea — la UI nunca es la única barrera.
 *
 * La gestión de usuarios (pending + all users) vive en `/more/admin/users`,
 * separada para no mezclar acciones sobre cuentas con las métricas de acá.
 */
export default function AdminPage() {
  const t = useTranslations();
  const router = useRouter();
  const ownAccess = useOwnAccess();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>("newVersion");
  const defaultBodyFor = (type: AnnouncementType) => t(ANNOUNCEMENT_DEFAULT_BODY_KEY[type] as Parameters<typeof t>[0], { version: APP_VERSION });
  const [broadcastBody, setBroadcastBody] = useState(defaultBodyFor("newVersion"));
  const [broadcasting, setBroadcasting] = useState(false);
  usePageHeader({ title: t("adminPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  // Defensa en profundidad: la entrada en Más ya se oculta a un no-operador
  // (`morePage`), y las tres RPC de abajo rechazan igual del lado servidor
  // — esto solo evita que alguien vea la UI vacía un instante si navega
  // acá a mano. `undefined` es "todavía no se sabe", nunca dispara nada.
  useEffect(() => {
    if (ownAccess !== undefined && !ownAccess.isAppAdmin) router.replace("/");
  }, [ownAccess, router]);

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: METRICS_KEY,
    queryFn: () => adminRepo.metrics(),
    enabled: ownAccess?.isAppAdmin === true,
  });

  const handleAnnouncementTypeChange = (type: string) => {
    const nextType = type as AnnouncementType;
    setAnnouncementType(nextType);
    setBroadcastBody(defaultBodyFor(nextType));
  };

  // D35 — el único disparador manual de un push broadcast (`kind:
  // "app_update"`): pega al Route Handler propio (nunca a la Edge
  // Function directo, que no tiene CORS a propósito), que reenvía la
  // sesión del operador — `send-push` es quien de verdad decide si puede.
  const handleBroadcastAppUpdate = async () => {
    if (broadcasting || !broadcastBody.trim()) return;
    setBroadcasting(true);
    try {
      const res = await fetch("/api/admin/notify-app-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t(ANNOUNCEMENT_TITLE_KEY[announcementType] as Parameters<typeof t>[0]), body: broadcastBody.trim() }),
      });
      if (!res.ok) throw new Error("broadcast failed");
      const { sent } = (await res.json()) as { sent: number };
      toast(t("adminPage.appUpdateBroadcast.sent", { count: sent }));
      setBroadcastOpen(false);
    } catch {
      toast(t("adminPage.appUpdateBroadcast.error"));
    } finally {
      setBroadcasting(false);
    }
  };

  const countryEntries = Object.entries(metrics?.byCountry ?? {}).sort(([, a], [, b]) => b - a);
  // Orden fijo, no por conteo — a diferencia de país, un rango etario tiene
  // un orden natural que hay que respetar en vez de reordenar por tamaño.
  const AGE_RANGE_ORDER = ["<25", "25-34", "35-44", "45-54", "55-64", "65+", "desconocido"];
  const ageRangeEntries = AGE_RANGE_ORDER.map((range) => [range, metrics?.byAgeRange?.[range] ?? 0] as const).filter(([, count]) => count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
        <section>
          <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: "0 16px" }}>
            <ListRow label={t("adminPage.manageUsers")} meta={t("adminPage.manageUsersMeta")} onClick={() => router.push("/more/admin/users")} />
          </div>
        </section>

        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
            {t("adminPage.metricsSectionTitle")}
          </div>
          {loadingMetrics || !metrics ? (
            <Skeleton height={160} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}>
                <StatTile label={t("adminPage.totalUsers")} value={metrics.total} size="compact" />
                <StatTile label={t("adminPage.pendingCount")} value={metrics.pending} size="compact" />
                <StatTile label={t("adminPage.approvedCount")} value={metrics.approved} size="compact" />
                <StatTile label={t("adminPage.rejectedCount")} value={metrics.rejected} size="compact" />
                <StatTile label={t("adminPage.disabledCount")} value={metrics.disabled} size="compact" />
              </div>

              <div>
                <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
                  {t("adminPage.activitySectionTitle")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}>
                  <StatTile label={t("adminPage.activeToday")} value={metrics.activeToday} size="compact" />
                  <StatTile label={t("adminPage.active7d")} value={metrics.active7d} size="compact" />
                  <StatTile label={t("adminPage.active30d")} value={metrics.active30d} size="compact" />
                  <StatTile label={t("adminPage.inactive")} value={metrics.inactive} size="compact" />
                </div>
              </div>

              <div>
                <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
                  {t("adminPage.byCountryTitle")}
                </div>
                {countryEntries.length === 0 ? (
                  <EmptyState message={t("adminPage.noCountryData")} />
                ) : (
                  <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: "0 16px" }}>
                    {countryEntries.map(([country, count]) => (
                      <ListRow
                        key={country}
                        label={country in COUNTRY_MESSAGE_KEY ? t(COUNTRY_MESSAGE_KEY[country as keyof typeof COUNTRY_MESSAGE_KEY]) : country}
                        value={String(count)}
                        variant="value"
                        chevron={false}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
                  {t("adminPage.byAgeRangeTitle")}
                </div>
                {ageRangeEntries.length === 0 ? (
                  <EmptyState message={t("adminPage.noAgeData")} />
                ) : (
                  <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: "0 16px" }}>
                    {ageRangeEntries.map(([range, count]) => (
                      <ListRow
                        key={range}
                        label={range === "desconocido" ? t("adminPage.ageUnknown") : range}
                        value={String(count)}
                        variant="value"
                        chevron={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
            {t("adminPage.appUpdateBroadcast.sectionTitle")}
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: "0 16px" }}>
            <ListRow label={t("adminPage.appUpdateBroadcast.action")} meta={t("adminPage.appUpdateBroadcast.actionMeta")} onClick={() => setBroadcastOpen(true)} />
          </div>
        </section>
      </div>

      <Sheet open={broadcastOpen} title={t("adminPage.appUpdateBroadcast.sheetTitle")} onClose={() => setBroadcastOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("adminPage.appUpdateBroadcast.warning")}</p>
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
              {t("adminPage.appUpdateBroadcast.typeLabel")}
            </div>
            <SegmentedControl
              options={ANNOUNCEMENT_TYPES.map((type) => ({ id: type, label: t(ANNOUNCEMENT_TYPE_LABEL_KEY[type] as Parameters<typeof t>[0]) }))}
              value={announcementType}
              onChange={handleAnnouncementTypeChange}
              style={{ width: "100%" }}
            />
          </div>
          <Input label={t("adminPage.appUpdateBroadcast.bodyLabel")} value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} autoFocus />
          <Button variant="primary" disabled={broadcasting || !broadcastBody.trim()} onClick={handleBroadcastAppUpdate}>
            {broadcasting ? t("adminPage.appUpdateBroadcast.sending") : t("adminPage.appUpdateBroadcast.confirm")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
