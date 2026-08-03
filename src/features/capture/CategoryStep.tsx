"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CategoryBubble, Input, ListRow, Sheet } from "@/design-system";
import type { CategoryRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { normalize } from "@/lib/search/rank";
import { findExistingCategoryByName } from "./create-category";

export interface CategoryStepProps {
  /** Todas las categorías del `kind` actual — la lista completa que aparece detrás de "Otras". */
  categories: CategoryRow[];
  /** Top 5 por uso real (`useFrequentCategories`) — lo que se ve por defecto. */
  frequent: CategoryRow[];
  selectedId: string | null;
  onSelect: (category: CategoryRow) => void;
  onCreate: (name: string) => Promise<CategoryRow>;
  /** Ítem 13 — editar nombre/ícono de una categoría propia. Ya no vive acá: la edición se mudó a Ajustes → Categorías (con el household entero a la vista, no solo el `kind` de esta captura), así que esta prop quedó sin uso — se deja documentado el motivo, no un `TODO`. */
}

/**
 * C2 — fallback del camino feliz. Grilla 3×2 de 6 burbujas: las 5 más
 * usadas + "Otras" (mismo patrón de burbuja sintética que
 * `budgets/new/page.tsx` usa para "todo el hogar"). "Otras" abre un sheet
 * con la grilla de TODAS las categorías del `kind` — no una lista de
 * búsqueda por default — más una burbuja final para crear una nueva.
 *
 * Interacción por categoría con subcategorías (p. ej. "Salud" →
 * Farmacia/Consultas, con un punto violeta que lo indica en la burbuja):
 * un tap corto SIEMPRE selecciona la categoría general, tal como está —
 * mantener presionado ~500ms despliega sus hijas en una vista aparte,
 * donde se puede confirmar igual la general o afinar a una específica.
 * Ya no hay un estado "expandido en el lugar": es una vista separada
 * (con volver), más simple de manejar en una grilla que en una lista.
 */
export function CategoryStep({ categories, frequent, selectedId, onSelect, onCreate }: CategoryStepProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const [otherOpen, setOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedParent, setExpandedParent] = useState<CategoryRow | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const needle = normalize(query);
  const searching = needle !== "";
  const filtered = useMemo(() => (searching ? categories.filter((c) => normalize(categoryLabel(c)).includes(needle)) : categories), [categories, categoryLabel, needle, searching]);
  const roots = useMemo(() => categories.filter((c) => c.parentId === null), [categories]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, CategoryRow[]>();
    for (const c of categories) {
      if (c.parentId === null) continue;
      map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
    }
    return map;
  }, [categories]);
  const exactMatch = query.trim() !== "" && findExistingCategoryByName(query, categories, categories[0]?.kind ?? "expense", categoryLabel) !== undefined;

  const closeOther = () => {
    setOtherOpen(false);
    setQuery("");
    setExpandedParent(null);
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

  const expandedChildren = expandedParent ? (childrenOf.get(expandedParent.id) ?? []) : [];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, paddingTop: 8 }}>
        {frequent.map((c) => (
          <CategoryBubble key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} selected={c.id === selectedId} onClick={() => onSelect(c)} />
        ))}
        <CategoryBubble icon="more" label={t("capture.category.other")} selected={false} onClick={() => setOtherOpen(true)} />
      </div>

      <Sheet
        open={otherOpen}
        title={expandedParent ? categoryLabel(expandedParent) : t("capture.category.sheetTitle")}
        onClose={closeOther}
        height="70%"
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 16 }}>
          {expandedParent ? (
            <>
              <ListRow icon="chevron-left" label={t("capture.category.backToCategories")} chevron={false} onClick={() => setExpandedParent(null)} style={{ marginTop: -4 }} />
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                  <CategoryBubble
                    icon={expandedParent.icon as IconName}
                    label={t("capture.category.selectGeneral", { name: categoryLabel(expandedParent) })}
                    selected={expandedParent.id === selectedId}
                    onClick={() => handleSelect(expandedParent)}
                  />
                  {expandedChildren.map((child) => (
                    <CategoryBubble key={child.id} icon={child.icon as IconName} label={categoryLabel(child)} selected={child.id === selectedId} onClick={() => handleSelect(child)} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Sin `autoFocus`: la mayoría de las veces la categoría se
                  elige tocando la grilla, no escribiendo — levantar el
                  teclado apenas se abre "Otras" tapa media grilla. La
                  burbuja "Agregar categoría" sí enfoca esto a propósito:
                  ahí el usuario ya pidió escribir un nombre. */}
              <div ref={searchWrapperRef}>
                <Input placeholder={t("capture.category.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {filtered.length === 0 && !searching ? (
                  <p className="t-body" style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 24 }}>
                    {t("capture.category.noResults")}
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    {(searching ? filtered : roots).map((c) => {
                      const kids = searching ? [] : (childrenOf.get(c.id) ?? []);
                      const hasKids = kids.length > 0;
                      return (
                        <CategoryBubble
                          key={c.id}
                          icon={c.icon as IconName}
                          label={categoryLabel(c)}
                          selected={c.id === selectedId}
                          hasChildren={hasKids}
                          onLongPress={hasKids ? () => setExpandedParent(c) : undefined}
                          onClick={() => handleSelect(c)}
                        />
                      );
                    })}
                    {!searching ? (
                      <CategoryBubble
                        icon="plus"
                        label={t("capture.category.addNew")}
                        onClick={() => searchWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus()}
                      />
                    ) : null}
                  </div>
                )}
                {query.trim() !== "" && !exactMatch ? (
                  <ListRow icon="plus" variant="action" label={t("capture.category.createNew", { name: query.trim() })} disabled={creating} onClick={handleCreate} style={{ marginTop: 12 }} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
