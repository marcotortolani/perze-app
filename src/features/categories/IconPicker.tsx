"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, Input } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { normalize } from "@/lib/search/rank";
import { CATEGORY_ICON_GROUP_MESSAGE_KEY, CATEGORY_ICON_GROUPS, CATEGORY_ICON_MESSAGE_KEY, type CategoryIconWithLabel } from "@/lib/reference/category-icons";

export interface IconPickerProps {
  value: IconName;
  onChange: (icon: IconName) => void;
}

/**
 * Extracción literal de la grilla que vivía inline en `EditCategorySheet`
 * (44×44, `aria-pressed`, anillo `--selection-ring`) — sin rediseñar nada,
 * solo movida a su propio archivo para que la puedan consumir tanto el
 * sheet de editar como el de crear categoría/subcategoría. Vive en
 * `src/features/`, no en el design system: no tiene ficha en
 * `docs/contrato-componentes.md` y no debería inventarse una acá.
 *
 * Con ~57 íconos, una sola grilla plana ya no entra en dos pantallazos —
 * agrupa por tema y agrega buscador, filtrando sobre el nombre traducido
 * del ícono (`CATEGORY_ICON_MESSAGE_KEY`), mismo `normalize()` que usa
 * `CategoryStep`.
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return null;
    return CATEGORY_ICON_GROUPS.flatMap((g) => g.icons).filter((icon) => normalize(t(CATEGORY_ICON_MESSAGE_KEY[icon as CategoryIconWithLabel])).includes(needle));
  }, [query, t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Input placeholder={t("categoryTemplate.iconSearchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} />
      {filtered ? (
        <IconGrid icons={filtered} value={value} onChange={onChange} labelFor={(icon) => t(CATEGORY_ICON_MESSAGE_KEY[icon as CategoryIconWithLabel])} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {CATEGORY_ICON_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
                {t(CATEGORY_ICON_GROUP_MESSAGE_KEY[group.id])}
              </p>
              <IconGrid icons={group.icons} value={value} onChange={onChange} labelFor={(icon) => t(CATEGORY_ICON_MESSAGE_KEY[icon as CategoryIconWithLabel])} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconGrid({ icons, value, onChange, labelFor }: { icons: IconName[]; value: IconName; onChange: (icon: IconName) => void; labelFor: (icon: IconName) => string }) {
  if (icons.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
      {icons.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={labelFor(icon)}
          aria-pressed={value === icon}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: value === icon ? "var(--selection-surface)" : "var(--surface-2)",
            border: `2px solid ${value === icon ? "var(--selection-ring)" : "transparent"}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={19} color="var(--text-secondary)" />
        </button>
      ))}
    </div>
  );
}
