import type { CSSProperties } from "react";

export interface CsvPreviewTableProps {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Filas a mostrar — K9a/K9b muestran solo las primeras 3, nunca el archivo entero. */
  maxRows?: number | undefined;
  style?: CSSProperties | undefined;
}

/** Preview truncado de un CSV crudo — encabezado del archivo original, celdas con ellipsis. K9a/K9b. */
export function CsvPreviewTable({ headers, rows, maxRows = 3, style }: CsvPreviewTableProps) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius-card)", background: "var(--surface-2)", ...style }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, maxRows).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
