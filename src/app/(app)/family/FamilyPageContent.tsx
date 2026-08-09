"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Icon, Input, ListRow, Sheet, Skeleton, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { HouseholdIconPicker } from "@/features/household/HouseholdIconPicker";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useRemoteHouseholdMembers, useInvalidateRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { useInvites } from "@/hooks/use-invites";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { markHouseholdMemberFormer } from "@/lib/repos/household-members-remote";
import { householdsRepo } from "@/lib/repos/households-repo";
import { transactionSharesRepo } from "@/lib/repos/transaction-shares-repo";
import { computeNetBalances } from "@/lib/analytics/settle-up";

const ROLE_MESSAGE_KEY = {
  owner: "familyPage.roles.owner",
  admin: "familyPage.roles.admin",
  member: "familyPage.roles.member",
  viewer: "familyPage.roles.viewer",
} as const;

/** J1/J2 — grupo familiar: quién está, quién falta aceptar, entrada a comparar/invitar. Separado de `page.tsx` — ver el comentario en `budgets/BudgetsPageContent.tsx`. */
export default function FamilyPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const invalidateHousehold = useInvalidateHousehold();
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const invalidateMembers = useInvalidateRemoteHouseholdMembers(household?.id);
  const { data: invites } = useInvites(household?.id);
  usePageHeader({ title: t("morePage.family"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [iconDraft, setIconDraft] = useState<IconName>("users");
  const [savingEdit, setSavingEdit] = useState(false);

  if (!household || !members || !invites) {
    return <Skeleton height={200} style={{ marginTop: 16 }} />;
  }

  const pendingInvites = invites.filter((i) => i.acceptedBy === null && i.revokedAt === null);
  const myRole = members.find((m) => m.profileId === userId)?.role;
  const canRemove = myRole === "owner" || myRole === "admin";
  const householdIcon = (household.settings?.icon as IconName | undefined) ?? "users";

  const handleOpenEditSheet = () => {
    setNameDraft(household.name);
    setIconDraft(householdIcon);
    setEditSheetOpen(true);
  };

  const handleSaveEdit = async () => {
    const trimmed = nameDraft.trim();
    if (savingEdit) return;
    const patch: { name?: string; settings?: Record<string, unknown> } = {};
    if (trimmed && trimmed !== household.name) patch.name = trimmed;
    if (iconDraft !== householdIcon) patch.settings = { ...household.settings, icon: iconDraft };
    if (Object.keys(patch).length === 0) {
      setEditSheetOpen(false);
      return;
    }
    setSavingEdit(true);
    try {
      await householdsRepo.update(household.id, patch);
      invalidateHousehold();
      setEditSheetOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  // J10: un miembro que se va liquida o condona antes — nunca se lo saca
  // con saldo pendiente, así que se chequea el neto antes de tocar `status`.
  // Sacar a alguien del hogar es la excepción justificada al patrón
  // "reversible, no confirmable" de `CLAUDE.md`: corta el acceso de OTRA
  // persona al instante, no solo el propio, así que primero se confirma
  // con las consecuencias explícitas (`removeConfirmBody`) en vez de un
  // toast con deshacer.
  const handleRemove = async (targetId: string) => {
    if (!household) return;
    const shares = await transactionSharesRepo.listUnsettledForHousehold(household.id);
    const { byMember } = computeNetBalances(
      shares.map((s) => ({ memberId: s.memberId, shareAmountBase: s.shareAmountBase, paidBy: s.createdBy })),
      targetId
    );
    if ([...byMember.values()].some((v) => v !== 0n)) {
      toast(t("familyPage.mustSettleFirst"));
      router.push("/family/settle");
      return;
    }
    setRemoving(true);
    try {
      await markHouseholdMemberFormer(household.id, targetId);
      invalidateMembers();
      toast(t("familyPage.removed"));
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  if (members.length <= 1 && pendingInvites.length === 0) {
    return <EmptyState message={t("familyPage.empty")} actionLabel={t("familyPage.invite")} onAction={() => router.push("/family/invite")} />;
  }

  return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, paddingBottom: 24 }}>
        <ListRow icon="plus" label={t("familyPage.invite")} variant="action" onClick={() => router.push("/family/invite")} />
        {/* Editar nombre e ícono del hogar vive acá, no en Ajustes: es
            identidad del hogar, no una preferencia de formato, y este es el
            punto donde ya se está mirando el hogar activo. Tocar la fila
            abre el editor directo — mismo patrón que tags/payees y perfil,
            sin un ícono de lápiz aparte que compita por el tap. Cambiar de
            hogar (para quien tiene más de uno) sigue disponible desde /more. */}
        <ListRow
          icon={householdIcon}
          label={t("familyPage.householdName")}
          value={household.name}
          variant="value"
          disabled={!canRemove}
          onClick={() => canRemove && handleOpenEditSheet()}
        />
        {!canRemove ? (
          <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("familyPage.householdNameRestricted")}</p>
        ) : null}
        <ListRow icon="lock" label={t("permissionsPage.title")} onClick={() => router.push("/family/permissions")} />
        <ListRow icon="handshake" label={t("settlePage.title")} onClick={() => router.push("/family/settle")} />
        <ListRow icon="chart" label={t("comparePage.title")} onClick={() => router.push("/family/compare")} />
        <ListRow icon="list" label={t("activityPage.title")} onClick={() => router.push("/family/activity")} />
        <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 12 }}>{t("familyPage.members")}</div>
        {members.map((m) => (
        <ListRow
          key={m.profileId}
          // K2b — ícono elegido por cada persona en su perfil, sincronizado
          // acá vía `household_members.icon` (`useRemoteHouseholdMembers`).
          // Antes todos compartían el mismo glifo genérico "users", sin
          // forma de diferenciarse a simple vista.
          icon={(m.icon as IconName | null) ?? "user"}
          /* Tu propia fila se rotula con el idioma de la app, no con el
             `display_name` guardado: esa columna es una copia denormalizada
             pensada para que TE VEAN LOS DEMÁS, y los households creados
             antes de este fix tienen ahí un "Vos" literal que aparecía tal
             cual con la app en inglés. */
          label={m.profileId === userId ? t("familyPage.you") : (m.displayName?.trim() || t("familyPage.unnamed"))}
          meta={t(ROLE_MESSAGE_KEY[m.role])}
          onClick={m.profileId !== userId ? () => router.push(`/family/mirror/${m.profileId}`) : undefined}
          right={
            canRemove && m.profileId !== userId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveTarget({ id: m.profileId, name: m.displayName?.trim() || t("familyPage.unnamed") });
                }}
                aria-label={t("familyPage.remove", { name: m.displayName?.trim() || t("familyPage.unnamed") })}
                style={{ background: "none", border: 0, padding: 8, margin: -8, cursor: "pointer" }}
              >
                <Icon name="close" size={16} color="var(--text-muted)" />
              </button>
            ) : undefined
          }
        />
      ))}
      {pendingInvites.length > 0 ? (
        <>
          <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 12 }}>{t("familyPage.pendingInvites")}</div>
          {pendingInvites.map((invite) => (
            <ListRow key={invite.id} icon="mail" label={invite.email ?? t("familyPage.codeInvite", { code: invite.code })} meta={t("familyPage.pending")} />
          ))}
        </>
      ) : null}
      <Sheet open={!!removeTarget} title={removeTarget ? t("familyPage.removeConfirmTitle", { name: removeTarget.name }) : undefined} onClose={() => (removing ? null : setRemoveTarget(null))}>
        {removeTarget ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
              {t("familyPage.removeConfirmBody")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="danger" disabled={removing} onClick={() => handleRemove(removeTarget.id)}>
                {t("familyPage.removeConfirmAction")}
              </Button>
              <Button variant="ghost" disabled={removing} onClick={() => setRemoveTarget(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={editSheetOpen} title={t("familyPage.householdNameSheetTitle")} onClose={() => (savingEdit ? null : setEditSheetOpen(false))} height={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("familyPage.householdIcon")}</div>
            <HouseholdIconPicker value={iconDraft} onChange={setIconDraft} />
          </div>
          <Input label={t("familyPage.householdName")} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
          <Button disabled={!nameDraft.trim() || savingEdit} onClick={handleSaveEdit}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
      </div>
  );
}
