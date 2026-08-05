"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, CategoryBubble, Keypad, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateBudgets } from "@/hooks/use-budgets";
import { budgetsRepo } from "@/lib/repos/budgets-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { formatAmount } from "@/lib/money/format";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

/** F2 — crear presupuesto: elegir categoría (o el household entero) y el límite. */
export default function NewBudgetPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("budgetsPage.newBudget"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidateBudgets = useInvalidateBudgets(household?.id);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);

  // Con `cacheComponents: true` (Next 16), `router.back()` no desmonta esta
  // pantalla — la deja oculta (`Activity`, modo hidden) con su `useState`
  // intacto. Los efectos SÍ se limpian al ocultarse, así que la cleanup de
  // un efecto vacío es el único gancho confiable para "se abandonó este
  // formulario": ahí se resetea el borrador entero, para que el próximo
  // presupuesto arranque en cero en vez de heredar el monto del anterior
  // (bug reportado). Mismo patrón que `recurring/new/page.tsx`.
  useEffect(() => {
    return () => {
      setCategoryId(null);
      setExpr("");
      setSaving(false);
    };
  }, []);

  const expenseCategories = categories.filter((c) => c.kind === "expense" && c.parentId === null);

  if (!household || !userId) return null;

  const canSave = expr.trim() !== "";
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const numberLocale = numberLocaleForUiLocale(locale);
  // Monto ya evaluado y formateado, no la expresión cruda — mismo motivo
  // que en `goals/new/page.tsx`.
  const heroAmount = formatAmount(evaluateKeypadExpression(expr || "0", household.baseCurrency, numberLocale), { showSign: false, locale: numberLocale });

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const limit = evaluateKeypadExpression(expr, household.baseCurrency, numberLocaleForUiLocale(locale));
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
      // `back()`, no `replace`/`push` — la lista ya está en el historial
      // justo debajo. `replace("/budgets")` duplicaba esa misma entrada.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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

        <div style={{ textAlign: "center" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("budgetsPage.amount")}</div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 32 }}>{heroAmount}</div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <Keypad onKey={(k) => setExpr((s) => (k === "clear" ? "" : k === "backspace" ? s.slice(0, -1) : s + (k === "," ? decimalSeparator : k)))} onClear={() => setExpr("")} />
          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: 16 }}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
