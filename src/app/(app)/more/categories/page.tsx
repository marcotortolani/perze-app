"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, IconButton, ListRow, OptionCard, Skeleton, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTransactions } from "@/hooks/use-transactions";
import { householdsRepo } from "@/lib/repos/households-repo";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { applyCategoryTemplate, type CategoryTemplateChoice } from "@/lib/onboarding/apply-category-template";
import { BASIC_CATEGORY_TEMPLATE, COMPLETE_CATEGORY_TEMPLATE, type CategoryTemplateItem } from "@/lib/reference/category-templates";
import type { CategoryRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { EditCategorySheet } from "@/features/capture/EditCategorySheet";

const TEMPLATE_CHOICES: CategoryTemplateChoice[] = ["basic", "complete", "scratch"];

/**
 * `households.settings` (jsonb, ya sincroniza a Supabase — comentario de
 * la migración: "tema, acento, intensidad de animación, modo privacidad")
 * es donde vive esta preferencia: antes el `useState` arrancaba siempre en
 * "basic" y se olvidaba apenas se salía de la pantalla, aunque el usuario
 * hubiera elegido "completa" la vez anterior — ahora acompaña a la cuenta
 * entre dispositivos, no queda solo en este navegador.
 */
function templateChoiceFrom(settings: Record<string, unknown>): CategoryTemplateChoice {
  const stored = settings.categoryTemplateChoice;
  return typeof stored === "string" && (TEMPLATE_CHOICES as string[]).includes(stored) ? (stored as CategoryTemplateChoice) : "basic";
}

function countTemplateItems(items: typeof BASIC_CATEGORY_TEMPLATE): number {
  return items.reduce((sum, item) => sum + 1 + (item.children?.length ?? 0), 0);
}

/**
 * Nombres reales de la plantilla, para la opción seleccionada — antes solo
 * se veía un conteo ("21 categorías"), sin saber cuáles son. Los ítems con
 * subcategorías van en su propia línea con las hijas debajo; el resto se
 * agrupa en una línea final separada por "·".
 */
function CategoryTemplatePreview({ items }: { items: CategoryTemplateItem[] }) {
  const withChildren = items.filter((item) => item.children && item.children.length > 0);
  const withoutChildren = items.filter((item) => !item.children || item.children.length === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, marginBottom: 4, paddingLeft: 14, borderLeft: "2px solid var(--border)" }}>
      {withChildren.map((item) => (
        <div key={item.i18nKey}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{item.name}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {item.children!.map((child) => child.name).join(" · ")}
          </span>
        </div>
      ))}
      {withoutChildren.length > 0 ? (
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{withoutChildren.map((item) => item.name).join(" · ")}</span>
      ) : null}
    </div>
  );
}

/** A8 — plantilla de categorías. Fuera del camino crítico: Ajustes → Categorías. */
export default function CategoryTemplatePage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  if (!household || !categories || !transactions || !userId) {
    return (
      <div style={{ paddingTop: 16 }}>
        <Skeleton width={160} height={20} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} />
      </div>
    );
  }

  return <CategoryTemplateForm household={household} categories={categories} transactions={transactions} userId={userId} onBack={() => router.back()} />;
}

/**
 * Ítem 13 pedía poder editar nombre/ícono de una categoría propia; se
 * resolvió primero desde el picker de "Otro" en la captura
 * (`CategoryStep`), pero acá — Ajustes → Categorías, el lugar donde
 * alguien esperaría encontrarlo — no había ninguna forma de hacerlo. Mismo
 * `EditCategorySheet`, mismo `categoriesRepo.update`, un caller más.
 */
function YourCategoriesSection({
  categories,
  onEdit,
  onDelete,
}: {
  categories: CategoryRow[];
  onEdit: (id: string, patch: { name: string; icon: IconName }) => Promise<void>;
  onDelete: (category: CategoryRow) => void;
}) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const own = categories.filter((c) => !c.isSystem);

  return (
    <div>
      <p className="t-label" style={{ margin: "0 0 4px", color: "var(--text-secondary)" }}>
        {t("categoryTemplate.yourCategoriesTitle")}
      </p>
      {own.length === 0 ? (
        <p className="t-body" style={{ margin: 0, color: "var(--text-muted)" }}>
          {t("categoryTemplate.yourCategoriesEmpty")}
        </p>
      ) : (
        own.map((c) => (
          <ListRow
            key={c.id}
            icon={c.icon as IconName}
            label={categoryLabel(c)}
            chevron={false}
            right={
              // Frena la burbuja hacia la fila — `ListRow` con `right` ya
              // renderiza un `div`, no anida controles interactivos.
              <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>
                <IconButton icon="edit" ariaLabel={t("capture.category.edit")} size={36} iconSize={16} onClick={() => setEditing(c)} />
                <IconButton icon="trash" ariaLabel={t("categoryTemplate.deleteCategory")} size={36} iconSize={16} color="var(--critical)" onClick={() => onDelete(c)} />
              </span>
            }
          />
        ))
      )}
      <EditCategorySheet key={editing?.id ?? "none"} category={editing} onClose={() => setEditing(null)} onSave={onEdit} />
    </div>
  );
}

/**
 * Separado del wrapper de arriba a propósito: `useState(templateChoiceFrom(household.settings))`
 * solo lee el valor guardado correctamente si `household` YA está cargado
 * en el primer render de este componente — con el `useState` en el
 * wrapper (que también renderiza mientras `household` es `undefined`),
 * React fija el default "basic" en el montaje y nunca lo vuelve a leer
 * aunque el household llegue después.
 */
function CategoryTemplateForm({
  household,
  categories,
  transactions,
  userId,
  onBack,
}: {
  household: HouseholdRow;
  categories: CategoryRow[];
  transactions: TransactionRow[];
  userId: string;
  onBack: () => void;
}) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const invalidateCategories = useInvalidateCategories(household.id);
  const invalidateHousehold = useInvalidateHousehold();
  const [choice, setChoice] = useState<CategoryTemplateChoice>(() => templateChoiceFrom(household.settings));
  const [saving, setSaving] = useState(false);
  usePageHeader({ title: t("categoryTemplate.title"), onBack, backLabel: t("ds.appHeader.back") });

  const usedCategoryIds = useMemo(() => new Set(transactions.map((tx) => tx.categoryId).filter((id): id is string => id !== null)), [transactions]);

  const handleEditCategory = async (id: string, patch: { name: string; icon: IconName }) => {
    await categoriesRepo.update(id, patch);
    invalidateCategories();
  };

  /**
   * Archiva, nunca borra (CLAUDE.md § "apagar oculta, nunca borra") — la
   * fila sigue existiendo para cualquier movimiento histórico que ya la
   * tenga asignada, solo desaparece de los pickers. Reversible con
   * "Deshacer" en vez de un diálogo de confirmación: no hay otra forma de
   * restaurarla desde la UI hoy, así que el toast ES el camino de vuelta.
   */
  const handleDeleteCategory = (category: CategoryRow) => {
    const label = categoryLabel(category);
    void categoriesRepo.archive(category.id).then(() => {
      invalidateCategories();
    });
    toast(t("categoryTemplate.categoryDeleted", { name: label }), {
      action: {
        label: t("common.undo"),
        onClick: () => {
          void categoriesRepo.update(category.id, { archivedAt: null }).then(() => {
            invalidateCategories();
          });
        },
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await applyCategoryTemplate(household.id, choice, userId, usedCategoryIds);
    await householdsRepo.update(household.id, { settings: { ...household.settings, categoryTemplateChoice: choice } });
    invalidateCategories();
    invalidateHousehold();
    setSaving(false);
    toast(t("categoryTemplate.saved"));
    onBack();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* `lg`+: "Tus categorías" a la izquierda, la plantilla a la derecha —
          son dos secciones de contenido real, no una sola estirada a los
          1200px del layout. El scroller sigue siendo uno solo, envolviendo
          las dos columnas. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingTop: 16, gap: 24 }}>
        <div>
          <YourCategoriesSection categories={categories} onEdit={handleEditCategory} onDelete={handleDeleteCategory} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="t-label" style={{ margin: "0 0 4px", color: "var(--text-secondary)" }}>
            {t("categoryTemplate.templateSectionTitle")}
          </p>
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
          {choice === "basic" ? <CategoryTemplatePreview items={BASIC_CATEGORY_TEMPLATE} /> : null}
          <OptionCard
            title={t("categoryTemplate.completeTitle")}
            description={`${t("categoryTemplate.completeCount", { count: countTemplateItems(COMPLETE_CATEGORY_TEMPLATE) })} — ${t("categoryTemplate.completeDescription")}`}
            selected={choice === "complete"}
            onClick={() => setChoice("complete")}
          />
          {choice === "complete" ? <CategoryTemplatePreview items={COMPLETE_CATEGORY_TEMPLATE} /> : null}
          <OptionCard
            title={t("categoryTemplate.scratchTitle")}
            description={t("categoryTemplate.scratchDescription")}
            selected={choice === "scratch"}
            onClick={() => setChoice("scratch")}
          />
        </div>
      </div>
      {/* "Guardar" solo confirma la elección de plantilla (las ediciones de
          "Tus categorías" ya se guardan solas, por fila) — se alinea con el
          ancho de esa columna, no con las dos. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ paddingTop: 16, paddingBottom: 24 }}>
        <div className="hidden lg:block" />
        <Button onClick={handleSave} disabled={saving}>
          {t("categoryTemplate.save")}
        </Button>
      </div>
    </div>
  );
}
