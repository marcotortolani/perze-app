"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Amount, AppHeader, Button, EmptyState, Input, ListRow, Sheet, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateRecurringRules, useRecurringRules } from "@/hooks/use-recurring-rules";
import { recurringRulesRepo } from "@/lib/repos/recurring-rules-repo";
import { money } from "@/lib/money/money";

/** G3 — detalle y edición de una regla recurrente existente (la creación es G2, en `recurring/new`). */
export default function RecurringRuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useRecurringRules(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const invalidateRules = useInvalidateRecurringRules(household?.id);

  const [name, setName] = useState<string | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<string | null>(null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<"none" | "account" | "category">("none");
  const [saving, setSaving] = useState(false);

  if (!household || !rules) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  const rule = rules.find((r) => r.id === id);
  if (!rule) return <EmptyState message={t("recurringPage.notFound")} actionLabel={t("recurringPage.back")} onAction={() => router.push("/recurring")} />;

  const displayName = name ?? rule.name;
  const displayDay = dayOfMonth ?? String(rule.dayOfMonth);
  const accountId = accountIdOverride ?? rule.accountId;
  const categoryId = categoryIdOverride === undefined ? rule.categoryId : categoryIdOverride;
  const account = accounts.find((a) => a.id === accountId);
  const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
  const day = Math.min(31, Math.max(1, Number(displayDay) || 1));

  const handleSave = async () => {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    try {
      await recurringRulesRepo.update(rule.id, { name: displayName.trim(), dayOfMonth: day, accountId, categoryId: categoryId ?? null });
      invalidateRules();
      toast(t("recurringPage.updated"));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    await recurringRulesRepo.archive(rule.id);
    invalidateRules();
    toast(t("recurringPage.archived"));
    router.push("/recurring");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={rule.name} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
        <div style={{ textAlign: "center" }}>
          <Amount value={money(rule.expectedAmount, rule.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular />
        </div>
        <div className="t-caption" style={{ color: "var(--text-muted)", textAlign: "center" }}>{t(rule.kind === "expense" ? "capture.kind.expense" : "capture.kind.income")}</div>
        <Input label={t("recurringPage.name")} value={displayName} onChange={(e) => setName(e.target.value)} />
        <Input label={t("recurringPage.day")} placeholder="1-31" value={displayDay} onChange={(e) => setDayOfMonth(e.target.value.replace(/\D/g, ""))} />

        <button type="button" onClick={() => setSheet("account")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("goalsPage.account")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
        </button>

        <button type="button" onClick={() => setSheet("category")} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("budgetsPage.category")}</div>
          <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{category ? categoryLabel(category) : t("recurringPage.noCategory")}</div>
        </button>

        <div style={{ marginTop: "auto", paddingBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <Button disabled={!displayName.trim() || saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
          <Button variant="danger" onClick={handleArchive}>
            {t("recurringPage.archive")}
          </Button>
        </div>
      </div>

      <Sheet open={sheet === "account"} title={t("goalsPage.chooseAccount")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountIdOverride(a.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === "category"} title={t("budgetsPage.category")} onClose={() => setSheet("none")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {categories.filter((c) => c.kind === rule.kind).map((c) => (
            <ListRow key={c.id} label={categoryLabel(c)} onClick={() => { setCategoryIdOverride(c.id); setSheet("none"); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
