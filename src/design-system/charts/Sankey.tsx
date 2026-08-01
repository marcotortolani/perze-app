import type { CSSProperties } from "react";

export interface SankeyNode {
  id: string;
  label: string;
  /** Columna vertical (0 = arriba, ej. ingresos; N = abajo, ej. categorías de gasto). */
  column: number;
  color?: string | undefined;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  orientation?: "vertical" | undefined;
  width?: number | undefined;
  height?: number | undefined;
  style?: CSSProperties | undefined;
}

const NODE_HEIGHT = 44;
const NODE_WIDTH = 12;

/**
 * LIB-08: diagrama de flujo — orden de nodos por columna resuelto para
 * minimizar cruces (dentro de cada columna, ordenado por valor total
 * descendente); labels sobre la banda, nunca adentro (bandas finas no
 * tienen lugar para texto legible).
 */
export function Sankey({ nodes, links, width = 320, height = 320, style }: SankeyProps) {
  const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  const columnWidth = columns.length > 1 ? width / (columns.length - 1) : width;

  const valueByNode = new Map<string, number>();
  for (const l of links) {
    valueByNode.set(l.source, (valueByNode.get(l.source) ?? 0) + l.value);
    valueByNode.set(l.target, (valueByNode.get(l.target) ?? 0) + l.value);
  }
  const maxValue = Math.max(...valueByNode.values(), 1);

  const positioned = new Map<string, { x: number; y: number; h: number; node: SankeyNode }>();
  for (const col of columns) {
    const inColumn = nodes.filter((n) => n.column === col).sort((a, b) => (valueByNode.get(b.id) ?? 0) - (valueByNode.get(a.id) ?? 0));
    const totalGap = 8 * Math.max(inColumn.length - 1, 0);
    const availableHeight = height - totalGap;
    let cursor = 0;
    for (const n of inColumn) {
      const h = Math.max(NODE_HEIGHT, ((valueByNode.get(n.id) ?? 0) / maxValue) * availableHeight);
      positioned.set(n.id, { x: col * columnWidth, y: cursor, h, node: n });
      cursor += h + 8;
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", ...style }}>
      {links.map((l, i) => {
        const s = positioned.get(l.source);
        const t = positioned.get(l.target);
        if (!s || !t) return null;
        const sx = s.x + NODE_WIDTH;
        const tx = t.x;
        const sy = s.y + s.h / 2;
        const ty = t.y + t.h / 2;
        const mx = (sx + tx) / 2;
        const thickness = Math.max(2, (l.value / maxValue) * 40);
        return (
          <path
            key={`${l.source}-${l.target}-${i}`}
            d={`M${sx} ${sy} C${mx} ${sy} ${mx} ${ty} ${tx} ${ty}`}
            fill="none"
            stroke="var(--data-1)"
            strokeOpacity={0.28}
            strokeWidth={thickness}
          />
        );
      })}
      {[...positioned.values()].map(({ x, y, h, node }) => (
        <g key={node.id}>
          <rect x={x} y={y} width={NODE_WIDTH} height={h} rx="var(--bar-radius)" fill={node.color ?? "var(--data-1)"} />
          <text
            x={node.column === columns[0] ? x + NODE_WIDTH + 6 : x - 6}
            y={y + h / 2}
            dy="0.35em"
            fontSize="11"
            fill="var(--text-secondary)"
            textAnchor={node.column === columns[0] ? "start" : "end"}
            fontFamily="var(--font-sans)"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
