"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CategoryBubble, IconButton, Input, ListRow, Sheet } from "@/design-system";
import type { CategoryRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { normalize } from "@/lib/search/rank";
import { findExistingCategoryByName } from "./create-category";
import { EditCategorySheet } from "./EditCategorySheet";

export interface CategoryStepProps {
  /** Todas las categorías del `kind` actual — la lista completa que aparece detrás de "Otro". */
  categories: CategoryRow[];
  /** Top 5 por uso real (`useFrequentCategories`) — lo que se ve por defecto. */
  frequent: CategoryRow[];
  selectedId: string | null;
  onSelect: (category: CategoryRow) => void;
  onCreate: (name: string) => Promise<CategoryRow>;
  /** Ítem 13 — editar nombre/ícono de una categoría propia. `undefined` desactiva el lápiz (p. ej. si algún caller viejo todavía no lo pasa). */
  onEdit?: ((id: string, patch: { name: string; icon: IconName }) => Promise<void>) | undefined;
}

/**
 * C2 — fallback del camino feliz. Grilla 3×2 de 6 burbujas: las 5 más
 * usadas + "Otro" (mismo patrón de burbuja sintética que
 * `budgets/new/page.tsx` usa para "todo el hogar"). "Otro" abre un sheet
 * con buscador + lista completa + crear categoría nueva — nunca agrega un
 * paso más al flujo, seleccionar ahí cierra el sheet y selecciona.
 *
 * La lista completa arma un árbol de un nivel a partir de `parentId`: un
 * padre con hijas (p. ej. "Salud" → "Farmacia"/"Consultas") no selecciona
 * al tocarlo, despliega las hijas debajo — la primera fila del grupo
 * abierto es el padre mismo, ahora sí seleccionable, para poder confirmar
 * la categoría general o afinar a una más específica. Buscando, el árbol
 * se aplana: encontrar "farmacia" no debería depender de adivinar que es
 * hija de "Salud".
 */
export function CategoryStep({ categories, frequent, selectedId, onSelect, onCreate, onEdit }: CategoryStepProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const [otherOpen, setOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CategoryRow | null>(null);

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
    setOpenParents(new Set());
  };

  const handleSelect = (category: CategoryRow) => {
    onSelect(category);
    closeOther();
  };

  const toggleParent = (id: string) => {
    setOpenParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const editButton = (category: CategoryRow) =>
    onEdit && !category.isSystem ? (
      // Frena la burbuja del click hacia la fila — `ListRow` con `right`
      // ya renderiza un `div`, no un `button`, así que esto no anida
      // controles interactivos.
      <span onClick={(e) => e.stopPropagation()}>
        <IconButton icon="edit" ariaLabel={t("capture.category.edit")} size={36} iconSize={16} onClick={() => setEditing(category)} />
      </span>
    ) : undefined;

  const renderRow = (category: CategoryRow, options: { indent?: number; forceLeaf?: boolean } = {}) => {
    const indent = options.indent ?? 0;
    const kids = options.forceLeaf ? [] : (childrenOf.get(category.id) ?? []);
    const hasKids = kids.length > 0;
    const isOpen = openParents.has(category.id);
    return (
      <div key={category.id}>
        <ListRow
          icon={category.icon as IconName}
          label={categoryLabel(category)}
          chevron={hasKids}
          right={editButton(category)}
          style={indent ? { paddingLeft: indent } : undefined}
          onClick={hasKids ? () => toggleParent(category.id) : () => handleSelect(category)}
        />
        {hasKids && isOpen ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <ListRow
              icon={category.icon as IconName}
              label={t("capture.category.selectGeneral", { name: categoryLabel(category) })}
              chevron={false}
              style={{ paddingLeft: 24, color: "var(--text-secondary)" }}
              onClick={() => handleSelect(category)}
            />
            {kids.map((child) => renderRow(child, { indent: 24, forceLeaf: true }))}
          </div>
        ) : null}
      </div>
    );
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
          {/* Sin `autoFocus`: la mayoría de las veces la categoría se elige
              tocando, no escribiendo — levantar el teclado de entrada tapa
              media lista apenas se abre "Otro". */}
          <Input placeholder={t("capture.category.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p className="t-body" style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 24 }}>
                {t("capture.category.noResults")}
              </p>
            ) : searching ? (
              // Buscando, el árbol se aplana: cualquier categoría (padre o
              // hija) que matchea se muestra directo, seleccionable.
              filtered.map((c) => <ListRow key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} right={editButton(c)} onClick={() => handleSelect(c)} />)
            ) : (
              roots.map((c) => renderRow(c))
            )}
            {query.trim() !== "" && !exactMatch ? (
              <ListRow icon="plus" variant="action" label={t("capture.category.createNew", { name: query.trim() })} disabled={creating} onClick={handleCreate} />
            ) : null}
          </div>
        </div>
      </Sheet>

      <EditCategorySheet key={editing?.id ?? "none"} category={editing} onClose={() => setEditing(null)} onSave={onEdit ?? (async () => {})} />
    </>
  );
}
