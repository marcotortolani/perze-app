"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { HOUSEHOLD_ICON_MESSAGE_KEY, HOUSEHOLD_ICON_OPTIONS, type HouseholdIconWithLabel } from "@/lib/reference/household-icons";

export interface HouseholdIconPickerProps {
  value: IconName;
  onChange: (icon: IconName) => void;
}

/** Mismo grid de 44px/`aria-pressed`/anillo `--selection-ring` que `ProfileIconPicker`, con el set de `household-icons.ts` en vez del de persona. */
export function HouseholdIconPicker({ value, onChange }: HouseholdIconPickerProps) {
  const t = useTranslations();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
      {HOUSEHOLD_ICON_OPTIONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          aria-label={t(HOUSEHOLD_ICON_MESSAGE_KEY[icon as HouseholdIconWithLabel] as Parameters<typeof t>[0])}
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
