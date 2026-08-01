import type { CSSProperties, ReactNode } from "react";

export interface PositionRowProps {
  symbol: string;
  assetClass: string;
  /** `undefined` para instrumentos sin cantidad — el plazo fijo usa `alt` en su lugar. */
  quantity?: ReactNode | undefined;
  price?: ReactNode | undefined;
  value: ReactNode;
  changePct: ReactNode;
  /** Reemplaza cantidad/precio para el plazo fijo, que no tiene ninguno de los dos. */
  alt?: ReactNode | undefined;
  /** Tercera línea condicional — típicamente un `PriceStatus`. */
  status?: ReactNode | undefined;
  onClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
}

/** LIB-02: fila de posición — dos líneas, dos columnas de precisión fija, tercera línea condicional. */
export function PositionRow({ symbol, assetClass, quantity, price, value, changePct, alt, status, onClick, style }: PositionRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
        padding: "11px 0",
        background: "none",
        border: 0,
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, lineHeight: "22px", fontWeight: 500, color: "var(--text-primary)" }}>{symbol}</div>
          <div style={{ fontSize: 12, lineHeight: "16px", color: "var(--text-muted)" }}>{assetClass}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 16, color: "var(--text-primary)" }}>{value}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{changePct}</div>
        </div>
      </div>
      {alt ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{alt}</div>
      ) : quantity !== undefined || price !== undefined ? (
        <div style={{ display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-muted)" }}>
          {quantity !== undefined ? <span>{quantity}</span> : null}
          {price !== undefined ? <span>{price}</span> : null}
        </div>
      ) : null}
      {status ? <div style={{ marginTop: 2 }}>{status}</div> : null}
    </Tag>
  );
}
