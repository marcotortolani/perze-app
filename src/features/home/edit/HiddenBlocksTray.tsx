"use client";

import { useTranslations } from "next-intl";
import { SectionGroup, ListRow } from "@/design-system";
import type { HomeBlockId } from "../blocks/registry";
import { HOME_BLOCK_REGISTRY } from "../blocks/registry";

export interface HiddenBlocksTrayProps {
  hiddenIds: HomeBlockId[];
  onShow: (id: HomeBlockId) => void;
}

/** Bandeja de bloques ocultos, solo visible en modo edición y solo si hay algo ahí. */
export function HiddenBlocksTray({ hiddenIds, onShow }: HiddenBlocksTrayProps) {
  const t = useTranslations();
  if (hiddenIds.length === 0) return null;

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <SectionGroup label={t("home.customize.hiddenTitle")}>
        <div>
          {hiddenIds.map((id) => {
            const label = t(HOME_BLOCK_REGISTRY[id].labelKey);
            return (
              <ListRow
                key={id}
                label={label}
                variant="value"
                chevron={false}
                right={
                  <button
                    type="button"
                    onClick={() => onShow(id)}
                    aria-label={t("home.customize.showBlock", { block: label })}
                    data-home-block-action="show"
                    style={{ background: "none", border: 0, cursor: "pointer", padding: "8px 4px", color: "var(--primary-ink)", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500 }}
                  >
                    {t("home.customize.show")}
                  </button>
                }
              />
            );
          })}
        </div>
      </SectionGroup>
    </div>
  );
}
