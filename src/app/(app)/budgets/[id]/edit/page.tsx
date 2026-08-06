"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, CategoryBubble, EmptyState, Keypad, Skeleton, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgets, useInvalidateBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { budgetsRepo } from "@/lib/repos/budgets-repo";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { formatAmount } from "@/lib/money/format";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { amountToExpression } from "@/features/capture/AmountStep";

/**
 * F3 — editar un presupuesto existente: mismo layout que crear (`new/page.tsx`),
 * precargado con la categoría y el límite vigentes. Un presupuesto se crea con
 * un estimado que después varía en el tiempo — solo el límite y la categoría
 * cambian acá, nunca lo ya gastado (`computeBudgetProgress` sigue leyendo las
 * transacciones reales, esta pantalla no las toca).
 */
export default function EditBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  usePageHeader({ title: t("budgetsPage.editBudget"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidateBudgets = useInvalidateBudgets(household?.id);

  const budget = budgets?.find((b) => b.id === id);

  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null | undefined>(undefined);
  const [expr, setExpr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mismo motivo que `new/page.tsx`: con `cacheComponents: true` esta
  // pantalla queda oculta (no desmontada) al volver — se resetea el
  // borrador al abandonarla para que la próxima edición arranque desde el
  // valor real del presupuesto, no desde lo que se tipeó y no se guardó.
  useEffect(() => {
    return () => {
      setCategoryIdOverride(undefined);
      setExpr(null);
      setSaving(false);
    };
  }, []);

  const expenseCategories = categories.filter((c) => c.kind === "expense" && c.parentId === null);

  if (!household || !budgets) return <Skeleton height={300} style={{ marginTop: 16 }} />;
  if (!budget) return <EmptyState message={t("budgetsPage.notFound")} actionLabel={t("budgetsPage.back")} onAction={() => router.push("/budgets")} />;

  const categoryId = categoryIdOverride === undefined ? budget.categoryId : categoryIdOverride;
  const displayExpr = expr ?? amountToExpression(budget.amountLimit, budget.currencyCode, locale);
  const canSave = displayExpr.trim() !== "";
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const numberLocale = numberLocaleForUiLocale(locale);
  const heroAmount = formatAmount(evaluateKeypadExpression(displayExpr || "0", budget.currencyCode, numberLocale), { showSign: false, locale: numberLocale });

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const limit = evaluateKeypadExpression(displayExpr, budget.currencyCode, numberLocale);
      const category = categories.find((c) => c.id === categoryId);
      await budgetsRepo.update(budget.id, {
        categoryId,
        name: category ? categoryLabel(category) : t("budgetsPage.wholeHousehold"),
        amountLimit: limit.amount,
      });
      invalidateBudgets();
      toast(t("budgetsPage.updated"));
      // `back()`, no `replace`/`push` — el detalle ya está en el historial
      // justo debajo, mismo criterio que `recurring/[id]/edit/page.tsx`.
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
            <CategoryBubble icon="wallet" label={t("budgetsPage.wholeHousehold")} selected={categoryId === null} onClick={() => setCategoryIdOverride(null)} />
            {expenseCategories.map((c) => (
              <CategoryBubble key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} selected={categoryId === c.id} onClick={() => setCategoryIdOverride(c.id)} />
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("budgetsPage.amount")}</div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 32 }}>{heroAmount}</div>
        </div>

        <div style={{ marginTop: "auto" }}>
          {/* `s ?? displayExpr` en las dos ramas, no solo en backspace: el
              keypad arranca "vacío" (`expr === null`) mostrando el límite
              vigente como placeholder editable — el primer dígito tipeado
              tiene que seguir apendando sobre ESE valor, igual que
              backspace lo borra de a un carácter, en vez de partir de "" y
              perder el prefill con la primera tecla. */}
          <Keypad onKey={(k) => setExpr((s) => (k === "clear" ? "" : k === "backspace" ? (s ?? displayExpr).slice(0, -1) : (s ?? displayExpr) + (k === "," ? decimalSeparator : k)))} onClear={() => setExpr("")} />
          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: 16 }}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
