"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useCategories } from "@/hooks/use-categories";
import { useInvalidateCategorizationRules } from "@/hooks/use-categorization-rules";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";
import { RuleForm } from "@/features/rules/RuleForm";

/** K7 — nueva regla: si {campo} {contiene} "{valor}", asigná esta categoría. */
export default function NewCategorizationRulePage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: categories = [] } = useCategories(household?.id);
  const invalidate = useInvalidateCategorizationRules(household?.id);
  usePageHeader({ title: t("categorizationRulesPage.newRule"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !userId) return null;

  return (
    <RuleForm
      categories={categories}
      onSave={async (values) => {
        await categorizationRulesRepo.create({
          householdId: household.id,
          name: values.name,
          priority: 0,
          match: { field: values.field, op: "contains", value: values.value },
          actions: { categoryId: values.categoryId, tagIds: [], payeeId: null },
          isActive: true,
          createdBy: userId,
        });
        invalidate();
        toast(t("categorizationRulesPage.created"));
        // `back()`, no `replace`/`push` — la lista ya está en el historial
        // justo debajo. `replace("/more/rules")` duplicaba esa misma entrada.
        router.back();
      }}
    />
  );
}
