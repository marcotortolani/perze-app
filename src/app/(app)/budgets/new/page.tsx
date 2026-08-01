"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, CategoryBubble, Keypad } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateBudgets } from "@/hooks/use-budgets";
import { budgetsRepo } from "@/lib/repos/budgets-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";

/** F2 — crear presupuesto: elegir categoría (o el household entero) y el límite. */
export default function NewBudgetPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidateBudgets = useInvalidateBudgets(household?.id);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.kind === "expense" && c.parentId === null);

  if (!household) return null;

  const canSave = expr.trim() !== "";

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const limit = evaluateKeypadExpression(expr, household.baseCurrency);
      const category = categories.find((c) => c.id === categoryId);
      await budgetsRepo.create({
        householdId: household.id,
        categoryId,
        name: category ? categoryLabel(category) : t("budgetsPage.wholeHousehold"),
        amountLimit: limit.amount,
        currencyCode: household.baseCurrency,
        createdBy: userId,
      });
      invalidateBudgets();
      toast(t("budgetsPage.created"));
      router.push("/budgets");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("budgetsPage.newBudget")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 20 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 10 }}>{t("budgetsPage.category")}</div>
          <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
            <CategoryBubble icon="wallet" label={t("budgetsPage.wholeHousehold")} selected={categoryId === null} onClick={() => setCategoryId(null)} />
            {expenseCategories.map((c) => (
              <CategoryBubble key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)} />
            ))}
          </div>
        </div>

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
    </div>
  );
}
