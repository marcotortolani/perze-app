"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, SegmentedControl, Sheet, ZMark } from "@/design-system";
import { useCategoryLabel } from "@/hooks/use-category-label";
import type { CategoryRow, RuleMatchField } from "@/lib/db/schema";

export interface RuleFormValues {
  name: string;
  field: RuleMatchField;
  value: string;
  categoryId: string;
}

export interface RuleFormProps {
  categories: CategoryRow[];
  /** Valores iniciales — al crear se omite y arranca vacío. */
  initial?: Partial<RuleFormValues> | undefined;
  onSave: (values: RuleFormValues) => Promise<void>;
  /** Solo al editar. Sin diálogo de confirmación: se ejecuta y se ofrece deshacer. */
  onDelete?: (() => void) | undefined;
}

/**
 * "Si {campo} contiene {valor}, asigná {categoría}" — el cuerpo compartido
 * entre crear y editar una regla de auto-categorización.
 *
 * Existe porque editar llegó después de crear y la alternativa era duplicar
 * el formulario entero en `[id]/edit`: dos copias del mismo `SegmentedControl`,
 * el mismo sheet de categorías y la misma validación, listas para separarse
 * con el primer retoque.
 *
 * El layout de dos columnas con el `ZMark` a la derecha es el mismo que ya
 * usan `debts/new`, `goals/new` y `family/invite`: en escritorio el
 * formulario es angosto y la mitad derecha quedaría vacía.
 */
export function RuleForm({ categories, initial, onSave, onDelete }: RuleFormProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();

  const [name, setName] = useState(initial?.name ?? "");
  const [field, setField] = useState<RuleMatchField>(initial?.field ?? "note");
  const [value, setValue] = useState(initial?.value ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const canSave = name.trim() !== "" && value.trim() !== "" && categoryId !== null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), field, value: value.trim(), categoryId: categoryId! });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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

          {/* `marginTop: auto` empuja las acciones al fondo de la columna —
              el botón primario vive en los últimos 200px de la pantalla
              (`CLAUDE.md` § interfaz). */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <Button disabled={!canSave || saving} onClick={handleSave}>
              {t("common.save")}
            </Button>
            {onDelete ? (
              <Button variant="danger" disabled={saving} onClick={onDelete}>
                {t("categorizationRulesPage.deleteRule")}
              </Button>
            ) : null}
          </div>
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
