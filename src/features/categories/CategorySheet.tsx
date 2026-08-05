"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, Sheet } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import type { CategoryKind, CategoryRow } from "@/lib/db/schema";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { IconPicker } from "./IconPicker";

export type CategorySheetTarget = { mode: "edit"; category: CategoryRow } | { mode: "create"; kind: CategoryKind; parent: CategoryRow | null };

export interface CategorySheetProps {
  target: CategorySheetTarget | null;
  onClose: () => void;
  onSave: (target: CategorySheetTarget, values: { name: string; icon: IconName }) => Promise<void>;
  onDelete: (category: CategoryRow) => void;
  onAddSubcategory: (parent: CategoryRow) => void;
}

/**
 * Reemplaza a `EditCategorySheet` (movido de `features/capture/`) y lo
 * extiende a modo crear — antes `categoriesRepo.create()` no tenía ningún
 * caller de UI fuera de "crear al vuelo desde Otro" en la captura. Un solo
 * sheet para las tres acciones (crear raíz, crear subcategoría, editar)
 * porque comparten forma exacta: nombre + ícono.
 *
 * El padre no se elige acá: una subcategoría se crea desde adentro del
 * sheet de SU padre (`onAddSubcategory`), así que `target.parent` ya viene
 * resuelto desde el caller — cero selector, cero ambigüedad.
 */
export function CategorySheet({ target, onClose, onSave, onDelete, onAddSubcategory }: CategorySheetProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  // Init perezoso desde `target` — el caller pasa `key={...}` para remontar
  // (y así reinicializar este estado) solo cuando cambia el target, igual
  // que hacía `EditCategorySheet` con `key={category?.id}`.
  const [name, setName] = useState(target?.mode === "edit" ? target.category.name : "");
  const [icon, setIcon] = useState<IconName>(target?.mode === "edit" ? (target.category.icon as IconName) : "tag");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!target || !name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(target, { name: name.trim(), icon });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title =
    target?.mode === "edit"
      ? t("capture.category.editTitle")
      : target?.mode === "create" && target.parent
        ? t("categoryTemplate.newSubcategoryTitle", { parent: categoryLabel(target.parent) })
        : t("categoryTemplate.newCategoryTitle");

  // Solo se puede agregar una subcategoría a una raíz existente (editando
  // una raíz), no a una hija ni durante la creación — dos niveles de
  // profundidad es lo que el resto de la app (captura, plantillas) asume.
  const canAddSubcategory = target?.mode === "edit" && target.category.parentId === null;

  return (
    // `--content-max-width` (560px) — mismo criterio que el sheet de monto
    // de `recurring/[id]/edit`: sin capar el panel entero, `Overlay` lo deja
    // en 90% del ancho en desktop, y el grid de íconos (`auto-fill, 1fr`)
    // se estira para llenar ese ancho — una sola fila larguísima por grupo,
    // con los íconos separados por huecos enormes, en vez de un grid
    // compacto que envuelve en varias filas como en mobile.
    <Sheet open={target !== null} title={title} onClose={onClose} height="auto" style={{ maxWidth: "var(--content-max-width)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Input label={t("capture.category.editName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus={target?.mode === "create"} />
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.category.editIcon")}
          </p>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        {canAddSubcategory && target?.mode === "edit" ? (
          <ListRow icon="plus" label={t("categoryTemplate.addSubcategory")} variant="action" onClick={() => onAddSubcategory(target.category)} />
        ) : null}
        <Button variant="primary" disabled={!name.trim() || saving} onClick={handleSave}>
          {t("common.save")}
        </Button>
        {target?.mode === "edit" ? (
          <Button
            variant="danger"
            disabled={saving}
            onClick={() => {
              onDelete(target.category);
              onClose();
            }}
          >
            {t("categoryTemplate.deleteCategory")}
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
