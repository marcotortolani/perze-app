"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader, Button, EmptyState, ListRow, Skeleton, StatTile } from "@/design-system";
import { adminRepo } from "@/lib/repos/admin-repo";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { useOwnAccess } from "@/hooks/use-own-access";
import { formatNumericDate, type Locale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";

const ACCESS_REQUESTS_KEY = ["admin", "access-requests"] as const;
const METRICS_KEY = ["admin", "metrics"] as const;

/**
 * Panel del operador (§3.3) — pantalla nueva, fuera de `enabled_modules`
 * (no es un módulo opcional del producto, es de la instancia entera).
 * Gateado dos veces: `src/app/(app)/more/page.tsx` solo dibuja la entrada
 * si `is_app_admin`, y las tres RPC de `adminRepo` rechazan a cualquiera
 * que no lo sea — la UI nunca es la única barrera.
 */
export default function AdminPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);
  const ownAccess = useOwnAccess();

  // Defensa en profundidad: la entrada en Más ya se oculta a un no-operador
  // (`morePage`), y las tres RPC de abajo rechazan igual del lado servidor
  // — esto solo evita que alguien vea la UI vacía un instante si navega
  // acá a mano. `undefined` es "todavía no se sabe", nunca dispara nada.
  useEffect(() => {
    if (ownAccess !== undefined && !ownAccess.isAppAdmin) router.replace("/");
  }, [ownAccess, router]);

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ACCESS_REQUESTS_KEY,
    queryFn: () => adminRepo.listAccessRequests(),
    enabled: ownAccess?.isAppAdmin === true,
  });
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: METRICS_KEY,
    queryFn: () => adminRepo.metrics(),
    enabled: ownAccess?.isAppAdmin === true,
  });

  const pending = (requests ?? []).filter((r) => r.accessStatus === "pending");

  const handleDecide = async (profileId: string, status: "approved" | "rejected") => {
    if (acting) return;
    setActing(profileId);
    try {
      await adminRepo.setAccessStatus(profileId, status);
      toast(status === "approved" ? t("adminPage.approvedToast") : t("adminPage.rejectedToast"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY }),
        queryClient.invalidateQueries({ queryKey: METRICS_KEY }),
      ]);
    } finally {
      setActing(null);
    }
  };

  const countryEntries = Object.entries(metrics?.byCountry ?? {}).sort(([, a], [, b]) => b - a);
  // Orden fijo, no por conteo — a diferencia de país, un rango etario tiene
  // un orden natural que hay que respetar en vez de reordenar por tamaño.
  const AGE_RANGE_ORDER = ["<25", "25-34", "35-44", "45-54", "55-64", "65+", "desconocido"];
  const ageRangeEntries = AGE_RANGE_ORDER.map((range) => [range, metrics?.byAgeRange?.[range] ?? 0] as const).filter(([, count]) => count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("adminPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
            {t("adminPage.pendingSectionTitle")}
          </div>
          {loadingRequests ? (
            <Skeleton height={120} />
          ) : pending.length === 0 ? (
            <EmptyState message={t("adminPage.pendingEmpty")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pending.map((request) => (
                <div key={request.profileId} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="t-body" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {request.email ?? request.displayName ?? request.profileId}
                  </div>
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                    {request.country ?? t("adminPage.unknownCountry")} · {t("adminPage.requestedOn", { date: formatNumericDate(locale, new Date(request.accessRequestedAt), dateFormat) })}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <Button variant="secondary" disabled={acting === request.profileId} onClick={() => handleDecide(request.profileId, "approved")} style={{ flex: 1 }}>
                      {t("adminPage.approve")}
                    </Button>
                    <Button variant="secondary" disabled={acting === request.profileId} onClick={() => handleDecide(request.profileId, "rejected")} style={{ flex: 1 }}>
                      {t("adminPage.reject")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      </div>
    </div>
  );
}
