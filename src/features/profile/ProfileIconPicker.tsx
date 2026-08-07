"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { PROFILE_ICON_MESSAGE_KEY, PROFILE_ICON_OPTIONS, type ProfileIconWithLabel } from "@/lib/reference/profile-icons";

export interface ProfileIconPickerProps {
  value: IconName;
  onChange: (icon: IconName) => void;
}

/**
 * K2b — ícono que diferencia a cada miembro del household (antes todos
 * compartían el mismo glifo genérico "users" en Familia, y un movimiento no
 * decía quién lo cargó). Mismo grid de 44px/`aria-pressed`/anillo
 * `--selection-ring` que `IconPicker` de categorías, pero sin agrupar por
 * tema ni buscador: ~25 íconos entran enteros en una sola grilla, y el set
 * (`PROFILE_ICON_OPTIONS`) es de identidad de persona, no de rubro de
 * gasto — no tiene sentido reusar `IconPicker` tal cual, que trae ese set
 * y esa UI de grupos hardcodeados adentro.
 */
export function ProfileIconPicker({ value, onChange }: ProfileIconPickerProps) {
  const t = useTranslations();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
      {PROFILE_ICON_OPTIONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={t(PROFILE_ICON_MESSAGE_KEY[icon as ProfileIconWithLabel] as Parameters<typeof t>[0])}
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
