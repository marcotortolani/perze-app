"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../core/Icon";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";

export interface TransactionRowProps {
  icon?: IconName | undefined;
  merchant: string;
  /** "Cuenta · Categoría" — una línea, truncada. */
  meta?: string | undefined;
  value: Money;
  /** Monto convertido o en moneda original, en mono. */
  secondary?: string | undefined;
  polarity?: "positive" | "negative" | "negative-emphasis" | "neutral" | undefined;
  privacy?: boolean | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** Un movimiento en la lista: ícono, comercio, cuenta/categoría, monto. Swipe izquierda borra, derecha edita. */
export function TransactionRow({ icon = "cart", merchant, meta, value, secondary, polarity, privacy = false, onClick, style }: TransactionRowProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "11px 0",
        cursor: onClick ? "pointer" : "default",
        transform: pressed && onClick ? "scale(var(--press-scale))" : "scale(1)",
        transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
        ...style,
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={19} color="var(--text-secondary)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 16, lineHeight: "22px", fontWeight: 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {merchant}
        </span>
        {meta ? (
          <span style={{ display: "block", fontSize: 13, lineHeight: "18px", color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </span>
        ) : null}
      </span>
      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <Amount value={value} size="body" polarity={polarity} tabular privacy={privacy} style={{ display: "block" }} />
        {secondary ? (
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
            {secondary}
          </span>
        ) : null}
      </span>
    </div>
  );
}
