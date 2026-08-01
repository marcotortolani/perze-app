"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Input, Keypad, ListRow, Sheet } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useInvalidateGoals } from "@/hooks/use-goals";
import { useTransactions } from "@/hooks/use-transactions";
import { goalsRepo } from "@/lib/repos/goals-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { computeThreeMonthCushion } from "@/lib/analytics/goal-projection";
import { formatAmountCompact } from "@/lib/money/format";
import { money, toMajorUnitsUnsafe } from "@/lib/money/money";

/** F7 — crear meta: nombre, monto objetivo, cuenta que la respalda. La sugerencia "colchón de 3 meses" (F7, estado vacío del diseño) prellena el monto con 3x el gasto diario promedio de los últimos 90 días. */
export default function NewGoalPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id);
  const invalidateGoals = useInvalidateGoals(household?.id);

  const [name, setName] = useState("");
  const [expr, setExpr] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!household) return null;

  const account = accounts.find((a) => a.id === accountId);
  const canSave = name.trim() !== "" && expr.trim() !== "";
  const cushion = computeThreeMonthCushion(transactions, new Date());
  const cushionMoney = money(cushion, household.baseCurrency);

  const useCushion = () => setExpr(String(toMajorUnitsUnsafe(cushionMoney)).replace(".", ","));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const target = evaluateKeypadExpression(expr, household.baseCurrency);
      await goalsRepo.create({
        householdId: household.id,
        name: name.trim(),
        icon: null,
        color: null,
        targetAmount: target.amount,
        currencyCode: household.baseCurrency,
        targetDate: null,
        accountId,
        createdBy: userId,
      });
      invalidateGoals();
      toast(t("goalsPage.created"));
      router.push("/goals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("goalsPage.newGoal")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
        <Input label={t("goalsPage.name")} placeholder={t("goalsPage.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />

        {expr.trim() === "" && cushion > 0n ? (
          <ListRow
            icon="target"
            label={t("goalsPage.useCushion", { amount: formatAmountCompact(cushionMoney, { showSign: false }) })}
            variant="action"
            onClick={useCushion}
          />
        ) : null}

        <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.account")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
        </button>

        <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 32 }}>
          {household.baseCurrency} {expr || "0"}
        </div>

        <div style={{ marginTop: "auto" }}>
          <Keypad onKey={(k) => setExpr((s) => (k === "clear" ? "" : k === "backspace" ? s.slice(0, -1) : s + (k === "," ? "," : k)))} onClear={() => setExpr("")} />
          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: 16 }}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <Sheet open={accountSheetOpen} title={t("goalsPage.chooseAccount")} onClose={() => setAccountSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setAccountSheetOpen(false); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
