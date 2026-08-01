"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, OptionCard, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { applyCategoryTemplate, type CategoryTemplateChoice } from "@/lib/onboarding/apply-category-template";
import { BASIC_CATEGORY_TEMPLATE, COMPLETE_CATEGORY_TEMPLATE } from "@/lib/reference/category-templates";

function countTemplateItems(items: typeof BASIC_CATEGORY_TEMPLATE): number {
  return items.reduce((sum, item) => sum + 1 + (item.children?.length ?? 0), 0);
}

/** A8 — plantilla de categorías. Fuera del camino crítico: Ajustes → Categorías. */
export default function CategoryTemplatePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const invalidateCategories = useInvalidateCategories(household?.id);
  const [choice, setChoice] = useState<CategoryTemplateChoice>("basic");
  const [saving, setSaving] = useState(false);

  const usedCategoryIds = useMemo(() => new Set((transactions ?? []).map((tx) => tx.categoryId).filter((id): id is string => id !== null)), [transactions]);

  if (!household || !categories || !transactions) {
    return (
      <div style={{ paddingTop: 16 }}>
        <Skeleton width={160} height={20} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await applyCategoryTemplate(household.id, choice, userId, usedCategoryIds);
    invalidateCategories();
    setSaving(false);
    toast(t("categoryTemplate.saved"));
    router.back();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("categoryTemplate.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 10 }}>
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t("categoryTemplate.subtitle")}
        </p>
        <div style={{ height: 6 }} />
        <OptionCard
          title={t("categoryTemplate.basicTitle")}
          description={t("categoryTemplate.basicCount", { count: countTemplateItems(BASIC_CATEGORY_TEMPLATE) })}
          selected={choice === "basic"}
          onClick={() => setChoice("basic")}
        />
        <OptionCard
          title={t("categoryTemplate.completeTitle")}
          description={`${t("categoryTemplate.completeCount", { count: countTemplateItems(COMPLETE_CATEGORY_TEMPLATE) })} — ${t("categoryTemplate.completeDescription")}`}
          selected={choice === "complete"}
          onClick={() => setChoice("complete")}
        />
        <OptionCard
          title={t("categoryTemplate.scratchTitle")}
          description={t("categoryTemplate.scratchDescription")}
          selected={choice === "scratch"}
          onClick={() => setChoice("scratch")}
        />
        <div style={{ marginTop: "auto", paddingBottom: 24 }}>
          <Button onClick={handleSave} disabled={saving}>
            {t("categoryTemplate.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
