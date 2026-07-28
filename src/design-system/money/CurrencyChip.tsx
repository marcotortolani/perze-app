"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

const FLAGS: Record<string, string> = { UYU: "🇺🇾", USD: "🇺🇸", ARS: "🇦🇷", EUR: "🇪🇺", BRL: "🇧🇷" };

export interface CurrencyChipProps {
  currency?: string | undefined;
  selected?: boolean | undefined;
  /** Abre el sheet de selección de moneda. */
  onClick?: (() => void) | undefined;
  showChevron?: boolean | undefined;
  style?: CSSProperties | undefined;
}

/** Chip de bandera + código ISO; tap abre el selector. El único lugar del sistema donde aparece emoji. */
export function CurrencyChip({ currency = "UYU", selected = false, onClick, showChevron = true, style }: CurrencyChipProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 36,
        padding: "0 12px",
        borderRadius: "var(--radius-chip)",
        cursor: "pointer",
        background: selected ? "var(--primary-fill)" : "var(--surface-2)",
        color: selected ? "var(--primary-on-fill)" : "var(--text-primary)",
        border: selected ? "1px solid transparent" : "1px solid var(--border)",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 13,
        lineHeight: 1,
        transform: pressed ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ fontFamily: "var(--font-sans)", fontSize: 15 }}>
        {FLAGS[currency] ?? "🏳"}
      </span>
      {currency}
      {showChevron ? <Icon name="chevron-down" size={14} strokeWidth={1.75} /> : null}
    </button>
  );
}
