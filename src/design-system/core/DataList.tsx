import type { CSSProperties, ReactNode } from "react";

export interface DataListColumn {
  key: string;
  label: string;
  width?: number | string | undefined;
}

export interface DataListRow {
  /** La fila destacada — la próxima cuota, el total. */
  emphasis?: boolean | undefined;
  [key: string]: ReactNode | boolean | undefined;
}

export interface DataListProps {
  columns: DataListColumn[];
  rows: DataListRow[];
  style?: CSSProperties | undefined;
}

/**
 * Tabla sin bordes — la alternativa accesible obligatoria de todo gráfico
 * (`ChartCard`, toggle "ver como tabla") y de cualquier otra lista tabular
 * del sistema. Primera columna a la izquierda en sans, el resto a la
 * derecha en mono con `tabular-nums` — nunca al revés, o los números dejan
 * de alinear entre filas.
 */
export function DataList({ columns, rows, style }: DataListProps) {
  return (
    <div role="table" style={{ display: "flex", flexDirection: "column", ...style }}>
      <div role="row" style={{ display: "flex", gap: 8, padding: "0 0 8px" }}>
        {columns.map((col, i) => (
          <span
            key={col.key}
            role="columnheader"
            className="t-caption"
            style={{ flex: col.width ?? 1, minWidth: 0, textAlign: i === 0 ? "left" : "right", color: "var(--text-muted)" }}
          >
            {col.label}
          </span>
        ))}
      </div>
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          role="row"
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 0",
            borderTop: "1px solid var(--gridline)",
            color: row.emphasis ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: row.emphasis ? 600 : 400,
          }}
        >
          {columns.map((col, i) => (
            <span
              key={col.key}
              role="cell"
              style={{
                flex: col.width ?? 1,
                minWidth: 0,
                textAlign: i === 0 ? "left" : "right",
                fontFamily: i === 0 ? "var(--font-sans)" : "var(--font-mono)",
                fontVariantNumeric: i === 0 ? undefined : "tabular-nums",
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row[col.key] as ReactNode}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
