"use client";

import { CategoryBubble } from "@/design-system";
import type { CategoryRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";
import { useCategoryLabel } from "@/hooks/use-category-label";

export interface CategoryStepProps {
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (category: CategoryRow) => void;
}

/** C2 — fallback del camino feliz: grid de burbujas, 3 columnas. */
export function CategoryStep({ categories, selectedId, onSelect }: CategoryStepProps) {
  const categoryLabel = useCategoryLabel();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, paddingTop: 8 }}>
      {categories.map((c) => (
        <CategoryBubble key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} selected={c.id === selectedId} onClick={() => onSelect(c)} />
      ))}
    </div>
  );
}
