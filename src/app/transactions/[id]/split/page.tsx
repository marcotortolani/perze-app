"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Amount, Button, IconButton, Switch } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { useTransaction } from "@/hooks/use-transactions";
import { transactionSharesRepo } from "@/lib/repos/transaction-shares-repo";
import { splitEqual } from "@/lib/analytics/split-shares";
import { money } from "@/lib/money/money";
import { formatAmount } from "@/lib/money/format";

/**
 * J6 — dividir un gasto entre miembros del household. Ruta hermana fuera
 * de `(app)/`: es un flujo de pantalla completa, no una vista con tab bar.
 *
 * Solo partes iguales por ahora: "porcentaje"/"monto exacto" (J6 completo)
 * necesitan un input por miembro que todavía no se construyó — mejor
 * dejarlos afuera que ofrecer un selector que no hace nada distinto.
 */
export default function SplitTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: transaction } = useTransaction(id);
  const { data: members } = useRemoteHouseholdMembers(household?.id);

  // `null` = el usuario todavía no tocó nada en esta sesión de edición —
  // se usa el default derivado del reparto ya guardado (si existe). Nunca
  // se sincroniza vía efecto: evita el round-trip de reconciliación que
  // dispara el lint de "setState en efecto" (y una re-render de más).
  const [selectedOverride, setSelectedOverride] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const existingSharesQuery = useQuery({
    queryKey: ["transaction-shares", id],
    queryFn: () => transactionSharesRepo.listForTransaction(id),
    enabled: !!id,
  });

  const defaultSelected = useMemo(() => new Set((existingSharesQuery.data ?? []).map((s) => s.memberId)), [existingSharesQuery.data]);
  const selected = selectedOverride ?? defaultSelected;

  const preview = useMemo(() => {
    if (!transaction || selected.size === 0) return new Map<string, bigint>();
    return splitEqual(transaction.amount, [...selected].map((memberId) => ({ memberId })));
  }, [transaction, selected]);

  if (!household || !transaction || !members) return null;

  const toggleMember = (memberId: string) => {
    const next = new Set(selected);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    setSelectedOverride(next);
  };

  const handleSave = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    try {
      // needs_fx: si la transacción todavía no tiene amount_base, ningún
      // share puede tenerlo tampoco — se guarda igual, sin inventar un rate.
      const targets = [...selected].map((memberId) => ({ memberId }));
      const baseSplit = transaction.amountBase !== null ? splitEqual(transaction.amountBase, targets) : null;

      await transactionSharesRepo.replaceSplit(
        id,
        [...selected].map((memberId) => ({
          transactionId: id,
          memberId,
          shareAmount: preview.get(memberId) ?? 0n,
          shareAmountBase: baseSplit?.get(memberId) ?? null,
          sharePct: null,
          splitMode: "equal",
        }))
      );
      toast(t("splitPage.saved"));
      // `back()`, no `replace`/`push` — el detalle ya está en el
      // historial justo debajo. `replace` a esa MISMA url duplicaba la
      // entrada.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("splitPage.back")} onClick={() => router.back()} style={{ margin: -11 }} />
        <h1 className="t-title" style={{ margin: 0 }}>{t("splitPage.title")}</h1>
      </div>

      <div style={{ textAlign: "center" }}>
        <Amount value={money(transaction.amount, transaction.currencyCode)} size="hero" fit showSign={false} tabular />
      </div>

      <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("splitPage.equal")}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {members.map((m) => {
          const isSelf = m.profileId === userId;
          const checked = selected.has(m.profileId);
          const amount = preview.get(m.profileId);
          return (
            <div key={m.profileId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px" }}>
              <span style={{ fontSize: 16, color: "var(--text-primary)" }}>{isSelf ? t("splitPage.you") : (m.displayName ?? t("familyPage.unnamed"))}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {checked && amount !== undefined ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)" }}>{formatAmount(money(amount, transaction.currencyCode), { showSign: false })}</span>
                ) : null}
                <Switch checked={checked} onChange={() => toggleMember(m.profileId)} id={`split-${m.profileId}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button disabled={selected.size === 0 || saving} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </ScreenShell>
  );
}
