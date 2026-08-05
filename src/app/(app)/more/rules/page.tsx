"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, ListRow, Skeleton, Switch, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCategorizationRules, useInvalidateCategorizationRules } from "@/hooks/use-categorization-rules";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";

/** K7 — reglas de auto-categorización: condición → acción, con cuántas veces se aplicó. */
export default function CategorizationRulesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useCategorizationRules(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidate = useInvalidateCategorizationRules(household?.id);
  usePageHeader({ title: t("categorizationRulesPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !rules) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const handleToggle = async (id: string, isActive: boolean) => {
    await categorizationRulesRepo.update(id, { isActive });
    invalidate();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {rules.length === 0 ? (
          <EmptyState message={t("categorizationRulesPage.empty")} actionLabel={t("categorizationRulesPage.newRule")} onAction={() => router.push("/more/rules/new")} />
        ) : (
          <>
            <ListRow icon="plus" label={t("categorizationRulesPage.newRule")} variant="action" onClick={() => router.push("/more/rules/new")} />
            {rules.map((rule) => {
              const category = rule.actions.categoryId ? categoryById.get(rule.actions.categoryId) : undefined;
              return (
                // `onClick` abre el editor. Antes la fila no era tocable: una
                // regla mal escrita no se podía corregir ni sacar, solo
                // apagar — y apagada seguía ocupando la lista igual.
                //
                // El `stopPropagation` del `Switch` es necesario, no
                // decorativo: con un slot `right` presente `ListRow` no puede
                // ser un `<button>` (un botón no admite contenido
                // interactivo adentro), así que renderiza un `div` con el
                // `onClick` en la raíz — y sin frenarlo acá, tocar el switch
                // apagaría la regla Y navegaría al editor.
                <ListRow
                  key={rule.id}
                  label={rule.name}
                  meta={t("categorizationRulesPage.meta", {
                    field: t(`categorizationRulesPage.field.${rule.match.field}`),
                    value: rule.match.value,
                    category: category ? categoryLabel(category) : t("categorizationRulesPage.noCategoryAction"),
                    count: rule.hitCount,
                  })}
                  onClick={() => router.push(`/more/rules/${rule.id}/edit`)}
                  right={
                    <span onClick={(e) => e.stopPropagation()}>
                      <Switch checked={rule.isActive} onChange={(on) => handleToggle(rule.id, on)} id={`rule-${rule.id}`} />
                    </span>
                  }
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
