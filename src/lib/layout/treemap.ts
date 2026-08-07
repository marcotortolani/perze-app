/**
 * Treemap cuadrado (algoritmo "squarified", Bruls/Huizing/van Wijk) — a
 * diferencia de `bento.ts` (formas de grilla ELEGIDAS, con anchos de
 * columna fijos independientes del peso real), acá el ÁREA de cada bloque
 * es literalmente proporcional a su peso dentro de un rectángulo de
 * tamaño fijo en píxeles. Nace para I9/D73: la asignación de inversiones
 * pide "un área disponible por dispositivo, sin scroll, donde cada bloque
 * ocupa su porcentaje" — eso es un treemap, no un bento grid.
 *
 * "Squarified" (vs. un treemap slice-and-dice ingenuo) minimiza el
 * aspect ratio de cada rectángulo fila a fila, para que ningún bloque
 * quede como una tira ilegible de 400×8px cuando su peso es chico.
 */

export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreemapNode<T> {
  item: T;
  rect: TreemapRect;
}

interface WeightedItem<T> {
  item: T;
  area: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Peor aspect ratio (≥ 1) entre los rectángulos que resultarían de meter `row` en una tira de espesor `sum(area)/length`, a lo largo de `length`. */
function worstRatio(row: readonly WeightedItem<unknown>[], length: number): number {
  const sum = row.reduce((s, r) => s + r.area, 0);
  if (sum <= 0 || length <= 0) return Infinity;
  const thickness = sum / length;
  let worst = 0;
  for (const r of row) {
    const along = r.area / thickness;
    const ratio = Math.max(thickness / along, along / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

/**
 * `width`/`height` en las unidades que se quieran (típicamente píxeles del
 * contenedor real, medidos con `ResizeObserver` — nunca un porcentaje
 * fijo, porque el aspect ratio del contenedor cambia el layout óptimo).
 * `items` no necesita venir ordenado — se ordena acá por peso descendente,
 * que es lo que el algoritmo necesita para converger bien.
 */
export function squarify<T>(items: readonly T[], weightOf: (item: T) => number, width: number, height: number): TreemapNode<T>[] {
  if (width <= 0 || height <= 0 || items.length === 0) return [];
  const totalWeight = items.reduce((s, i) => s + Math.max(0, weightOf(i)), 0);
  if (totalWeight <= 0) return [];

  const scale = (width * height) / totalWeight;
  const sorted: WeightedItem<T>[] = [...items]
    .filter((i) => weightOf(i) > 0)
    .sort((a, b) => weightOf(b) - weightOf(a))
    .map((item) => ({ item, area: weightOf(item) * scale }));

  const out: TreemapNode<T>[] = [];
  let box: Box = { x: 0, y: 0, w: width, h: height };
  let remaining = sorted;

  while (remaining.length > 0) {
    const horizontal = box.w <= box.h;
    const length = horizontal ? box.w : box.h;

    let row: WeightedItem<T>[] = [remaining[0]!];
    let i = 1;
    while (i < remaining.length) {
      const candidate = [...row, remaining[i]!];
      if (worstRatio(candidate, length) <= worstRatio(row, length)) {
        row = candidate;
        i++;
      } else break;
    }

    const rowArea = row.reduce((s, r) => s + r.area, 0);
    const thickness = rowArea / length;

    if (horizontal) {
      let x = box.x;
      for (const r of row) {
        const w = r.area / thickness;
        out.push({ item: r.item, rect: { x, y: box.y, width: w, height: thickness } });
        x += w;
      }
      box = { x: box.x, y: box.y + thickness, w: box.w, h: box.h - thickness };
    } else {
      let y = box.y;
      for (const r of row) {
        const h = r.area / thickness;
        out.push({ item: r.item, rect: { x: box.x, y, width: thickness, height: h } });
        y += h;
      }
      box = { x: box.x + thickness, y: box.y, w: box.w - thickness, h: box.h };
    }

    remaining = remaining.slice(row.length);
  }

  return out;
}
