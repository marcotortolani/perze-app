"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge, usePageHeader } from "@/design-system";
import { adminRepo } from "@/lib/repos/admin-repo";
import type { AccessStatus } from "@/lib/repos/profiles-repo";
import { useOwnAccess } from "@/hooks/use-own-access";
import { formatNumericDate, formatTimeOfDay, type Locale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";

const ACCESS_REQUESTS_KEY = ["admin", "access-requests"] as const;
const METRICS_KEY = ["admin", "metrics"] as const;

const ACCESS_STATUS_TOAST_KEY: Record<AccessStatus, string> = {
  pending: "adminPage.pendingToast",
  approved: "adminPage.approvedToast",
  rejected: "adminPage.rejectedToast",
  disabled: "adminPage.disabledToast",
};

const ACCESS_STATUS_MESSAGE_KEY: Record<AccessStatus, string> = {
  pending: "adminPage.status.pending",
  approved: "adminPage.status.approved",
  rejected: "adminPage.status.rejected",
  disabled: "adminPage.status.disabled",
};

const ACCESS_STATUS_BADGE_STATUS: Record<AccessStatus, "good" | "warning" | "serious" | "critical"> = {
  pending: "warning",
  approved: "good",
  rejected: "critical",
  // "serious", no "critical": a diferencia de rechazar una solicitud nueva,
  // deshabilitar es reversible en cualquier momento con el mismo botón.
  disabled: "serious",
};

// Acción de estado que ofrece "Todos los usuarios" para cada estado ya
// resuelto — `pending` queda afuera a propósito, eso lo resuelve la
// sección de arriba con su propio copy (Aprobar/Rechazar). El rechazo
// tampoco es terminal: la misma acción "Aprobar" que resuelve una
// solicitud pendiente revierte un rechazo.
const ACCESS_STATUS_NEXT_ACTION: Partial<Record<AccessStatus, { status: AccessStatus; labelKey: string; variant: "danger" | "secondary" }>> = {
  approved: { status: "disabled", labelKey: "adminPage.disable", variant: "danger" },
  disabled: { status: "approved", labelKey: "adminPage.enable", variant: "secondary" },
  rejected: { status: "approved", labelKey: "adminPage.approve", variant: "secondary" },
};

/**
 * Sub-página de `/more/admin` — separada del panel para no mezclar la
 * gestión de usuarios (pending + all users) con las métricas. Mismo
 * doble gateo que el panel: `more/page.tsx` oculta el link si no es
 * operador, y las RPC de `adminRepo` rechazan del lado servidor.
 */
export default function AdminUsersPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);
  const ownAccess = useOwnAccess();
  usePageHeader({ title: t("adminPage.usersPageTitle"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  useEffect(() => {
    if (ownAccess !== undefined && !ownAccess.isAppAdmin) router.replace("/");
  }, [ownAccess, router]);

  const {
    data: requests,
    isLoading: loadingRequests,
    isError: requestsErrored,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ACCESS_REQUESTS_KEY,
    queryFn: () => adminRepo.listAccessRequests(),
    enabled: ownAccess?.isAppAdmin === true,
  });

  const pending = (requests ?? []).filter((r) => r.accessStatus === "pending");
  // Todos los usuarios, más recientes primero — la RPC ya trae la lista
  // completa (`admin_list_access_requests` no filtra por estado), la
  // sección de arriba solo recorta a `pending`. `slice()` porque `requests`
  // ya viene ordenado por `access_requested_at DESC`.
  const allUsers = [...(requests ?? [])];

  const handleDecide = async (profileId: string, status: AccessStatus) => {
    if (acting) return;
    setActing(profileId);
    try {
      await adminRepo.setAccessStatus(profileId, status);
      toast(t(ACCESS_STATUS_TOAST_KEY[status] as Parameters<typeof t>[0]));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY }),
        queryClient.invalidateQueries({ queryKey: METRICS_KEY }),
      ]);
    } catch {
      toast.error(t("adminPage.decideError"));
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 28, paddingBottom: 24 }}>
      <section>
        <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>
          {t("adminPage.pendingSectionTitle")}
        </div>
        {loadingRequests ? (
          <Skeleton height={120} />
        ) : requestsErrored ? (
          <ErrorState what={t("adminPage.pendingLoadError")} onRetry={() => refetchRequests()} retryLabel={t("common.retry")} />
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
                  {request.country ?? t("adminPage.unknownCountry")} ·{" "}
                  {t("adminPage.requestedOn", {
                    date: formatNumericDate(locale, new Date(request.accessRequestedAt), dateFormat),
                    time: formatTimeOfDay(locale, new Date(request.accessRequestedAt)),
                  })}
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
          {t("adminPage.allUsersSectionTitle")}
        </div>
        {loadingRequests ? (
          <Skeleton height={120} />
        ) : requestsErrored ? (
          <ErrorState what={t("adminPage.pendingLoadError")} onRetry={() => refetchRequests()} retryLabel={t("common.retry")} />
        ) : allUsers.length === 0 ? (
          <EmptyState message={t("adminPage.allUsersEmpty")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allUsers.map((user) => (
              <div key={user.profileId} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div className="t-body" style={{ color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email ?? user.displayName ?? user.profileId}
                  </div>
                  <StatusBadge status={ACCESS_STATUS_BADGE_STATUS[user.accessStatus]}>{t(ACCESS_STATUS_MESSAGE_KEY[user.accessStatus] as Parameters<typeof t>[0])}</StatusBadge>
                </div>
                <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                  {t("adminPage.registeredOn", {
                    date: formatNumericDate(locale, new Date(user.accessRequestedAt), dateFormat),
                    time: formatTimeOfDay(locale, new Date(user.accessRequestedAt)),
                  })}
                  {" · "}
                  {user.lastSeenAt
                    ? t("adminPage.lastSeenOn", {
                        date: formatNumericDate(locale, new Date(user.lastSeenAt), dateFormat),
                        time: formatTimeOfDay(locale, new Date(user.lastSeenAt)),
                      })
                    : t("adminPage.neverConnected")}
                </div>
                {/* Acciones de estado sobre usuarios ya resueltos —
                    `pending` queda afuera a propósito, eso lo resuelve la
                    sección de arriba (Aprobar/Rechazar), no un tercer
                    camino acá. Un rechazo tampoco es terminal: reaparece
                    acá con "Aprobar" en vez de en la lista de pendientes,
                    para no simular una solicitud nueva. Nunca se ofrece
                    para un operador (`isAppAdmin`): ni sobre uno mismo ni
                    sobre otro — `admin_set_access_status()` lo rechaza
                    igual del lado servidor, esto es solo para no mostrar
                    un botón que va a fallar. */}
                {!user.isAppAdmin && ACCESS_STATUS_NEXT_ACTION[user.accessStatus] ? (
                  <Button
                    variant={ACCESS_STATUS_NEXT_ACTION[user.accessStatus]!.variant}
                    disabled={acting === user.profileId}
                    onClick={() => handleDecide(user.profileId, ACCESS_STATUS_NEXT_ACTION[user.accessStatus]!.status)}
                    style={{ marginTop: 4 }}
                  >
                    {t(ACCESS_STATUS_NEXT_ACTION[user.accessStatus]!.labelKey as Parameters<typeof t>[0])}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
