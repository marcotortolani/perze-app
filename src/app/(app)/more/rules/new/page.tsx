"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, SegmentedControl, Sheet, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateCategorizationRules } from "@/hooks/use-categorization-rules";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";
import type { RuleMatchField } from "@/lib/db/schema";

/** K7 — nueva regla: si {campo} {contiene} "{valor}", asigná esta categoría. */
export default function NewCategorizationRulePage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidate = useInvalidateCategorizationRules(household?.id);

  const [name, setName] = useState("");
  const [field, setField] = useState<RuleMatchField>("note");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  usePageHeader({ title: t("categorizationRulesPage.newRule"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !userId) return null;

  const category = categories.find((c) => c.id === categoryId);
  const canSave = name.trim() !== "" && value.trim() !== "" && categoryId !== null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await categorizationRulesRepo.create({
        householdId: household.id,
        name: name.trim(),
        priority: 0,
        match: { field, op: "contains", value: value.trim() },
        actions: { categoryId, tagIds: [], payeeId: null },
        isActive: true,
        createdBy: userId,
      });
      invalidate();
      toast(t("categorizationRulesPage.created"));
      router.push("/more/rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 16 }}>
          <Input label={t("categorizationRulesPage.name")} placeholder={t("categorizationRulesPage.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />

          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 8 }}>{t("categorizationRulesPage.conditionField")}</div>
            <SegmentedControl
              options={[
                { id: "note", label: t("categorizationRulesPage.field.note") },
                { id: "payeeName", label: t("categorizationRulesPage.field.payeeName") },
              ]}
              value={field}
              onChange={(id) => setField(id as RuleMatchField)}
            />
          </div>

          <Input label={t("categorizationRulesPage.conditionValue")} placeholder="uber" value={value} onChange={(e) => setValue(e.target.value)} />

          <button type="button" onClick={() => setCategorySheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("categorizationRulesPage.thenCategory")}</div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{category ? categoryLabel(category) : t("categorizationRulesPage.chooseCategory")}</div>
          </button>

          <Button disabled={!canSave || saving} onClick={handleSave} style={{ marginTop: "auto" }}>
            {t("common.save")}
          </Button>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={categorySheetOpen} title={t("categorizationRulesPage.thenCategory")} onClose={() => setCategorySheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {categories.map((c) => (
            <ListRow key={c.id} label={categoryLabel(c)} onClick={() => { setCategoryId(c.id); setCategorySheetOpen(false); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
