"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader, Button, Input, Keypad, ListRow, SegmentedControl, Sheet } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateRecurringRules } from "@/hooks/use-recurring-rules";
import { recurringRulesRepo } from "@/lib/repos/recurring-rules-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

/** G2 — nueva regla recurrente: nombre, cuenta, día del mes, monto esperado. */
export default function NewRecurringRulePage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const invalidateRules = useInvalidateRecurringRules(household?.id);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [expr, setExpr] = useState("");
  const [sheet, setSheet] = useState<"none" | "account" | "category">("none");
  const [saving, setSaving] = useState(false);

  if (!household || !userId) return null;

  const account = accounts.find((a) => a.id === accountId);
  const category = categories.find((c) => c.id === categoryId);
  const day = Math.min(31, Math.max(1, Number(dayOfMonth) || 1));
  const canSave = name.trim() !== "" && expr.trim() !== "" && !!accountId;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const amount = evaluateKeypadExpression(expr, household.baseCurrency, numberLocaleForUiLocale(locale));
      await recurringRulesRepo.create({
        householdId: household.id,
        name: name.trim(),
        kind,
        categoryId,
        accountId: accountId!,
        expectedAmount: amount.amount,
        currencyCode: household.baseCurrency,
        dayOfMonth: day,
        createdBy: userId,
      });
      invalidateRules();
      toast(t("recurringPage.created"));
      router.push("/recurring");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("recurringPage.newRule")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
        <SegmentedControl
          options={[
            { id: "expense", label: t("capture.kind.expense") },
            { id: "income", label: t("capture.kind.income") },
          ]}
          value={kind}
          onChange={(id) => setKind(id as "expense" | "income")}
        />
        <Input label={t("recurringPage.name")} placeholder={t("recurringPage.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={t("recurringPage.day")} placeholder="1-31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value.replace(/\D/g, ""))} />

        <button type="button" onClick={() => setSheet("account")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.account")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
        </button>

        <button type="button" onClick={() => setSheet("category")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("budgetsPage.category")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{category ? categoryLabel(category) : t("recurringPage.noCategory")}</div>
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

      <Sheet open={sheet === "account"} title={t("goalsPage.chooseAccount")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === "category"} title={t("budgetsPage.category")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {categories.filter((c) => c.kind === kind).map((c) => (
            <ListRow key={c.id} label={categoryLabel(c)} onClick={() => { setCategoryId(c.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
