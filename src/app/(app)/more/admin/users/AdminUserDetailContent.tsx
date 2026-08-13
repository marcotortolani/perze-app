"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, IconButton, ListRow, Skeleton, StatusBadge } from "@/design-system";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { ACCESS_STATUS_BADGE_STATUS, ACCESS_STATUS_MESSAGE_KEY, ACCESS_STATUS_NEXT_ACTION, ACCESS_STATUS_TOAST_KEY } from "@/lib/reference/access-status";
import { ACCESS_REQUESTS_KEY, useAccessRequest, useInvalidateAdmin } from "@/hooks/use-admin-users";
import { adminRepo, type AccessRequest } from "@/lib/repos/admin-repo";
import type { AccessStatus } from "@/lib/repos/profiles-repo";
import { formatNumericDate, formatRelativeDay, formatTimeOfDay, type Locale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import { userInitials } from "./user-monogram";

/**
 * Ficha del usuario seleccionado (`?user=<id>`) — identidad, campos y las
 * acciones de estado que antes vivían inline en cada card de la lista
 * vieja. Recibe `{ id }` por prop (nunca `params`), como pide la receta de
 * master-detail de CLAUDE.md.
 *
 * `onClose`: solo lo pasa `page.tsx` en el split de desktop — ahí el único
 * cierre visible antes era la flecha de "volver" del header del shell, que
 * lee como "salir de Usuarios" y no como "cerrar esta ficha". En mobile no
 * se pasa: `Modal contained` ya dibuja su propio botón de volver.
 */
export function AdminUserDetailContent({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateAdmin = useInvalidateAdmin();
  const [acting, setActing] = useState(false);

  const { data: user, isLoading } = useAccessRequest(id, true);

  const patch = (profileId: string, status: AccessStatus) => {
    queryClient.setQueryData<AccessRequest[]>(ACCESS_REQUESTS_KEY, (prev) => prev?.map((u) => (u.profileId === profileId ? { ...u, accessStatus: status } : u)));
  };

  /**
   * Optimista + rollback, con toast y Deshacer para las CUATRO acciones —
   * verificado que `admin_set_access_status()` solo hace un `UPDATE` sobre
   * `profiles` (sin trigger de email ni push), así que "reversible, no
   * confirmable" (CLAUDE.md) aplica sin excepción, incluida "Deshabilitar".
   */
  const applyStatus = async (target: AccessRequest, next: AccessStatus) => {
    if (acting) return;
    setActing(true);
    const previous = target.accessStatus;
    patch(target.profileId, next);
    try {
      await adminRepo.setAccessStatus(target.profileId, next);
    } catch {
      patch(target.profileId, previous);
      toast.error(t("adminPage.decideError"));
      setActing(false);
      return;
    }
    invalidateAdmin();
    setActing(false);
    toast(t(ACCESS_STATUS_TOAST_KEY[next] as Parameters<typeof t>[0]), {
      duration: 6000,
      action: {
        label: t("common.undo"),
        onClick: async () => {
          patch(target.profileId, previous);
          try {
            await adminRepo.setAccessStatus(target.profileId, previous);
          } catch {
            patch(target.profileId, next);
            toast.error(t("adminPage.users.undoError"));
            return;
          }
          invalidateAdmin();
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Skeleton width={48} height={48} radius={24} />
          <Skeleton width={160} height={16} />
          <Skeleton width={80} height={20} radius={999} />
        </div>
        <Skeleton height={200} />
      </div>
    );
  }

  if (!user) {
    return <EmptyState message={t("adminPage.users.detail.gone")} actionLabel={t("adminPage.users.detail.goneAction")} onAction={() => router.back()} />;
  }

  const label = user.email ?? user.displayName ?? user.profileId;
  const countryLabel = user.country ? (user.country in COUNTRY_MESSAGE_KEY ? t(COUNTRY_MESSAGE_KEY[user.country as keyof typeof COUNTRY_MESSAGE_KEY]) : user.country) : null;
  const nextAction = ACCESS_STATUS_NEXT_ACTION[user.accessStatus];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16, paddingBottom: 24 }}>
      {onClose ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -16, marginRight: -8 }}>
          <IconButton icon="close" size={36} iconSize={18} ariaLabel={t("adminPage.users.detail.back")} onClick={onClose} />
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
        <span style={{ width: 48, height: 48, borderRadius: 24, background: "var(--surface-2)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600 }}>
          {userInitials(label)}
        </span>
        <span className="t-body" style={{ color: "var(--text-primary)", fontWeight: 600, overflowWrap: "anywhere" }}>
          {label}
        </span>
        <StatusBadge status={ACCESS_STATUS_BADGE_STATUS[user.accessStatus]}>{t(ACCESS_STATUS_MESSAGE_KEY[user.accessStatus] as Parameters<typeof t>[0])}</StatusBadge>
      </div>

      <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: "4px 4px" }}>
        <ListRow label={t("adminPage.users.detail.email")} value={user.email ?? "—"} variant="value" />
        <ListRow label={t("adminPage.users.detail.name")} value={user.displayName ?? t("adminPage.users.noName")} variant="value" />
        <ListRow label={t("adminPage.users.detail.country")} value={countryLabel ?? t("adminPage.unknownCountry")} variant="value" />
        <ListRow label={t("adminPage.users.detail.requested")} value={`${formatNumericDate(locale, new Date(user.accessRequestedAt), dateFormat)} ${formatTimeOfDay(locale, new Date(user.accessRequestedAt))}`} variant="value" />
        <ListRow
          label={t("adminPage.users.detail.lastSeen")}
          value={
            user.lastSeenAt
              ? `${formatRelativeDay(locale, new Date(user.lastSeenAt))} · ${formatNumericDate(locale, new Date(user.lastSeenAt), dateFormat)} ${formatTimeOfDay(locale, new Date(user.lastSeenAt))}`
              : t("adminPage.neverConnected")
          }
          variant="value"
        />
        {user.isAppAdmin ? <ListRow label={t("adminPage.users.detail.role")} value={t("adminPage.users.detail.roleAdmin")} variant="value" /> : null}
        <ListRow label={t("adminPage.users.detail.profileId")} value={<span style={{ fontFamily: "var(--font-mono)", fontSize: 12, userSelect: "all" }}>{user.profileId}</span>} variant="value" />
      </div>

      {user.isAppAdmin ? (
        <p className="t-caption" style={{ color: "var(--text-secondary)" }}>
          {t("adminPage.users.detail.adminLocked")}
        </p>
      ) : user.accessStatus === "pending" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" disabled={acting} onClick={() => applyStatus(user, "approved")} style={{ flex: 1 }}>
            {t("adminPage.approve")}
          </Button>
          <Button variant="secondary" disabled={acting} onClick={() => applyStatus(user, "rejected")} style={{ flex: 1 }}>
            {t("adminPage.reject")}
          </Button>
        </div>
      ) : nextAction ? (
        <Button variant={nextAction.variant} disabled={acting} onClick={() => applyStatus(user, nextAction.status)}>
          {t(nextAction.labelKey as Parameters<typeof t>[0])}
        </Button>
      ) : null}
    </div>
  );
}
