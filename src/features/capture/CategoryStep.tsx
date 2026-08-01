"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CategoryBubble, Input, ListRow, Sheet } from "@/design-system";
import type { CategoryRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { normalize } from "@/lib/search/rank";
import { findExistingCategoryByName } from "./create-category";

export interface CategoryStepProps {
  /** Todas las categorías del `kind` actual — la lista completa que aparece detrás de "Otro". */
  categories: CategoryRow[];
  /** Top 5 por uso real (`useFrequentCategories`) — lo que se ve por defecto. */
  frequent: CategoryRow[];
  selectedId: string | null;
  onSelect: (category: CategoryRow) => void;
  onCreate: (name: string) => Promise<CategoryRow>;
}

/**
 * C2 — fallback del camino feliz. Grilla 3×2 de 6 burbujas: las 5 más
 * usadas + "Otro" (mismo patrón de burbuja sintética que
 * `budgets/new/page.tsx` usa para "todo el hogar"). "Otro" abre un sheet
 * con buscador + lista completa + crear categoría nueva — nunca agrega un
 * paso más al flujo, seleccionar ahí cierra el sheet y selecciona.
 */
export function CategoryStep({ categories, frequent, selectedId, onSelect, onCreate }: CategoryStepProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const [otherOpen, setOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const needle = normalize(query);
  const filtered = useMemo(() => (needle ? categories.filter((c) => normalize(categoryLabel(c)).includes(needle)) : categories), [categories, categoryLabel, needle]);
  const exactMatch = query.trim() !== "" && findExistingCategoryByName(query, categories, categories[0]?.kind ?? "expense", categoryLabel) !== undefined;

  const closeOther = () => {
    setOtherOpen(false);
    setQuery("");
  };

  const handleSelect = (category: CategoryRow) => {
    onSelect(category);
    closeOther();
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      onSelect(created);
      closeOther();
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, paddingTop: 8 }}>
        {frequent.map((c) => (
          <CategoryBubble key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} selected={c.id === selectedId} onClick={() => onSelect(c)} />
        ))}
        <CategoryBubble icon="more" label={t("capture.category.other")} selected={false} onClick={() => setOtherOpen(true)} />
      </div>

      <Sheet open={otherOpen} title={t("capture.category.sheetTitle")} onClose={closeOther} height="70%">
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 12 }}>
          <Input placeholder={t("capture.category.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus maxLength={60} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p className="t-body" style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 24 }}>
                {t("capture.category.noResults")}
              </p>
            ) : (
              filtered.map((c) => (
                <ListRow key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} onClick={() => handleSelect(c)} />
              ))
            )}
            {query.trim() !== "" && !exactMatch ? (
              <ListRow icon="plus" variant="action" label={t("capture.category.createNew", { name: query.trim() })} disabled={creating} onClick={handleCreate} />
            ) : null}
          </div>
        </div>
      </Sheet>
    </>
  );
}
