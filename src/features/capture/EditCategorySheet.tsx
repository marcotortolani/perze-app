"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, Sheet } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import type { CategoryRow } from "@/lib/db/schema";
import { CATEGORY_ICON_OPTIONS } from "@/lib/reference/category-icons";

export interface EditCategorySheetProps {
  category: CategoryRow | null;
  onClose: () => void;
  onSave: (id: string, patch: { name: string; icon: IconName }) => Promise<void>;
}

/**
 * Ítem 13 — hasta acá `categoriesRepo.update()` existía pero no tenía
 * ningún caller que editara nombre/ícono: una categoría creada por el
 * usuario nacía con `icon: "tag"` fijo (`create-category.ts`) y ahí se
 * quedaba para siempre. Se dispara desde el lápiz en el picker de "Otro"
 * (`CategoryStep`) — solo en categorías propias, nunca en las de sistema.
 * Mismo patrón visual que la grilla de color de cuentas
 * (`AccountFormFlow`): swatches de 44×44 con anillo de selección.
 */
export function EditCategorySheet({ category, onClose, onSave }: EditCategorySheetProps) {
  const t = useTranslations();
  // Init perezoso desde `category`, no un efecto: `CategoryStep` renderiza
  // este componente con `key={category?.id}` (ver el call site), así que
  // React ya remonta —y reinicia este estado— solo cuando cambia CUÁL
  // categoría se está editando, sin necesitar sincronizarlo a mano.
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<IconName>((category?.icon as IconName) ?? "tag");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!category || !name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(category.id, { name: name.trim(), icon });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={category !== null} title={t("capture.category.editTitle")} onClose={onClose} height="auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Input label={t("capture.category.editName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.category.editIcon")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
            {CATEGORY_ICON_OPTIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-label={key}
                aria-pressed={icon === key}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: icon === key ? "var(--selection-surface)" : "var(--surface-2)",
                  border: `2px solid ${icon === key ? "var(--selection-ring)" : "transparent"}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={key} size={19} color="var(--text-secondary)" />
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" disabled={!name.trim() || saving} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </Sheet>
  );
}
