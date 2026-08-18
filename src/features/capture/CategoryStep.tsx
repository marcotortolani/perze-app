"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CategoryBubble, Input, ListRow } from "@/design-system";
import type { CategoryRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { normalize } from "@/lib/search/rank";
import { findExistingCategoryByName } from "./create-category";
import { DetailPanelTransition } from "@/components/motion";

export interface CategoryStepProps {
  /** Todas las categorías del `kind` actual. */
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (category: CategoryRow) => void;
  onCreate: (name: string) => Promise<CategoryRow>;
  /** Ítem 13 — editar nombre/ícono de una categoría propia. Ya no vive acá: la edición se mudó a Ajustes → Categorías (con el household entero a la vista, no solo el `kind` de esta captura), así que esta prop quedó sin uso — se deja documentado el motivo, no un `TODO`. */
}

/**
 * C2 — el paso completo de categoría, mostrado cuando el usuario ya pidió
 * ver más que los 5 chips rápidos de `AmountStep` (tocó "Otras" ahí, o
 * llegó acá con "Siguiente" sin elegir ninguna). Antes esto arrancaba con
 * SU PROPIA fila de 5 más usadas + "Otras" — redundante con lo que
 * `AmountStep` ya mostró, y recién al tocar esa segunda "Otras" aparecía
 * la grilla completa. Un paso de más: acá se entra directo a la grilla
 * con TODAS las categorías del `kind` — no una lista de búsqueda por
 * default — más una burbuja final para crear una nueva.
 *
 * Interacción por categoría con subcategorías (p. ej. "Salud" →
 * Farmacia/Consultas, con un punto violeta que lo indica en la burbuja):
 * un tap corto SIEMPRE selecciona la categoría general, tal como está —
 * mantener presionado ~500ms despliega sus hijas en una vista aparte,
 * donde se puede confirmar igual la general o afinar a una específica.
 */
export function CategoryStep({ categories, selectedId, onSelect, onCreate }: CategoryStepProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
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

  const handleSelect = (category: CategoryRow) => {
    onSelect(category);
    // Elegir desde la vista de subcategorías vuelve a la grilla principal
    // — la selección ya quedó marcada ahí, y es donde está el botón de
    // Guardar/Siguiente.
    setExpandedParent(null);
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      onSelect(created);
      setQuery("");
    } finally {
      setCreating(false);
    }
  };

  const expandedChildren = expandedParent ? (childrenOf.get(expandedParent.id) ?? []) : [];

  // La grilla completa (raíces) y la de subcategorías de un padre expandido
  // son dos árboles distintos, no una variante de layout — sin nada que las
  // conecte, React las reemplaza de golpe al mantener presionada una
  // burbuja con hijas. `DetailPanelTransition` (mismo componente que ya
  // resuelve el swap de panel en `/transactions` y `/accounts`) funde y
  // desliza sin `AnimatePresence` — acá tampoco hace falta animar la
  // salida, solo que la entrada no sea un corte seco. `transitionKey` es el
  // id del padre expandido, o un centinela para la grilla raíz.
  if (expandedParent) {
    return (
      <DetailPanelTransition transitionKey={expandedParent.id}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 16, paddingTop: 8 }}>
          <ListRow icon="chevron-left" label={t("capture.category.backToCategories")} chevron={false} onClick={() => setExpandedParent(null)} style={{ marginTop: -4 }} />
          {/* Padding en el scroller, no en la grilla: sin esto la burbuja
              seleccionada (anillo + `scale(1.04)` sobre 64px) se recortaba
              contra el borde del contenedor en la primera fila y en los
              costados — más notorio en desktop, pero pasa igual en mobile. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 4px 8px" }}>
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
        </div>
      </DetailPanelTransition>
    );
  }

  return (
    <DetailPanelTransition transitionKey="root">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 16, paddingTop: 8 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title-size)", lineHeight: "var(--text-title-line)", fontWeight: 600 }}>
          {t("capture.category.sheetTitle")}
        </h2>
        {/* Sin `autoFocus`: la mayoría de las veces la categoría se elige
            tocando la grilla, no escribiendo. La burbuja "Agregar categoría"
            sí enfoca esto a propósito: ahí el usuario ya pidió escribir un
            nombre. */}
        <div ref={searchWrapperRef}>
          <Input placeholder={t("capture.category.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 4px 8px" }}>
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
                    // Mantener presionado deja la general marcada Y abre sus
                    // hijas — no una cosa o la otra. Soltar sin tocar
                    // ninguna hija ya deja la categoría elegida y el botón
                    // "Listo" habilitado; la burbuja "Usar '{name}' en
                    // general" de la vista de hijas se dibuja seleccionada
                    // sola, porque `selectedId` ya cambió acá.
                    onLongPress={
                      hasKids
                        ? () => {
                            onSelect(c);
                            setExpandedParent(c);
                          }
                        : undefined
                    }
                    onClick={() => handleSelect(c)}
                  />
                );
              })}
              {!searching ? (
                <CategoryBubble icon="plus" label={t("capture.category.addNew")} onClick={() => searchWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus()} />
              ) : null}
            </div>
          )}
          {query.trim() !== "" && !exactMatch ? (
            <ListRow icon="plus" variant="action" label={t("capture.category.createNew", { name: query.trim() })} disabled={creating} onClick={handleCreate} style={{ marginTop: 12 }} />
          ) : null}
        </div>
      </div>
    </DetailPanelTransition>
  );
}
