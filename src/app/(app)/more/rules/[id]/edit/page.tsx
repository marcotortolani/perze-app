"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCategories } from "@/hooks/use-categories";
import { useCategorizationRules, useInvalidateCategorizationRules } from "@/hooks/use-categorization-rules";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";
import { RuleForm } from "@/features/rules/RuleForm";

/**
 * K7 — editar y borrar una regla de auto-categorización. Antes las reglas se
 * podían crear y activar/desactivar, pero no corregir ni sacar: una regla mal
 * escrita quedaba para siempre, y apagarla con el switch la dejaba igual
 * ocupando la lista.
 *
 * El formulario es el mismo de `new/` (`RuleForm`), así que las dos pantallas
 * no se pueden separar por descuido.
 */
export default function EditCategorizationRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useCategorizationRules(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const invalidate = useInvalidateCategorizationRules(household?.id);
  usePageHeader({ title: t("categorizationRulesPage.editRule"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !rules) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const rule = rules.find((r) => r.id === id);
  if (!rule) {
    return <EmptyState message={t("categorizationRulesPage.notFound")} actionLabel={t("ds.appHeader.back")} onAction={() => router.back()} />;
  }

  /**
   * Borrar es reversible con el toast, no con un diálogo — `CLAUDE.md`
   * § "Reversible, no confirmable". Se vuelve a la lista con `back()`
   * porque es la entrada que ya está justo debajo en el historial.
   */
  const handleDelete = () => {
    void categorizationRulesRepo.remove(rule.id).then(() => { invalidate(); });
    router.back();
    toast(t("categorizationRulesPage.deleted", { name: rule.name }), {
      action: {
        label: t("common.undo"),
        onClick: () => {
          void categorizationRulesRepo.restore(rule.id).then(() => { invalidate(); });
        },
      },
    });
  };

  return (
    <RuleForm
      categories={categories}
      initial={{ name: rule.name, field: rule.match.field, value: rule.match.value, ...(rule.actions.categoryId ? { categoryId: rule.actions.categoryId } : {}) }}
      onSave={async (values) => {
        await categorizationRulesRepo.update(rule.id, {
          name: values.name,
          match: { ...rule.match, field: values.field, value: values.value },
          // El resto de `actions` (etiquetas, comercio) se conserva: este
          // formulario solo edita la categoría, y pisarlo con un objeto nuevo
          // borraría lo que otra pantalla haya puesto ahí.
          actions: { ...rule.actions, categoryId: values.categoryId },
        });
        invalidate();
        toast(t("categorizationRulesPage.updated"));
        router.back();
      }}
      onDelete={handleDelete}
    />
  );
}
