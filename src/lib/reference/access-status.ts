import type { AccessStatus } from "@/lib/repos/profiles-repo";

/**
 * Mapeos estáticos de `AccessStatus` compartidos entre la lista y el
 * detalle de `/more/admin/users` — antes vivían inline en el `page.tsx`
 * viejo (una sola pantalla, un solo consumidor); ahora los usan ambos.
 */

export const ACCESS_STATUS_TOAST_KEY: Record<AccessStatus, string> = {
  pending: "adminPage.pendingToast",
  approved: "adminPage.approvedToast",
  rejected: "adminPage.rejectedToast",
  disabled: "adminPage.disabledToast",
};

export const ACCESS_STATUS_MESSAGE_KEY: Record<AccessStatus, string> = {
  pending: "adminPage.status.pending",
  approved: "adminPage.status.approved",
  rejected: "adminPage.status.rejected",
  disabled: "adminPage.status.disabled",
};

export const ACCESS_STATUS_BADGE_STATUS: Record<AccessStatus, "good" | "warning" | "serious" | "critical"> = {
  pending: "warning",
  approved: "good",
  rejected: "critical",
  // "serious", no "critical": a diferencia de rechazar una solicitud nueva,
  // deshabilitar es reversible en cualquier momento con el mismo botón.
  disabled: "serious",
};

/**
 * Próxima acción que ofrece el detalle para cada estado — `pending` queda
 * afuera a propósito: ahí se ofrecen dos acciones (Aprobar/Rechazar), no
 * una sola "siguiente". El rechazo tampoco es terminal: la misma acción
 * "Aprobar" que resuelve una solicitud pendiente revierte un rechazo.
 */
export const ACCESS_STATUS_NEXT_ACTION: Partial<Record<AccessStatus, { status: AccessStatus; labelKey: string; variant: "danger" | "secondary" }>> = {
  approved: { status: "disabled", labelKey: "adminPage.disable", variant: "danger" },
  disabled: { status: "approved", labelKey: "adminPage.enable", variant: "secondary" },
  rejected: { status: "approved", labelKey: "adminPage.approve", variant: "secondary" },
};
