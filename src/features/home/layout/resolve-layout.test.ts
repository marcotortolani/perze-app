import { describe, expect, it } from "vitest";
import { resolveHomeLayout, type HomeLayoutCatalog } from "./resolve-layout";
import type { HomeBlockId } from "../blocks/registry";

const CATALOG: HomeLayoutCatalog = {
  catalog: ["a", "b", "c", "d", "e"] as unknown as HomeBlockId[],
  defaultLeft: ["a", "b", "c"] as unknown as HomeBlockId[],
  defaultRight: ["d", "e"] as unknown as HomeBlockId[],
};

describe("resolveHomeLayout", () => {
  it("doc null -> layout default", () => {
    const resolved = resolveHomeLayout(null, CATALOG);
    expect(resolved.left).toEqual(["a", "b", "c"]);
    expect(resolved.right).toEqual(["d", "e"]);
    expect(resolved.hidden).toEqual([]);
    expect(resolved.mobile).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("JSON corrupto -> layout default", () => {
    expect(resolveHomeLayout("no soy un objeto", CATALOG)).toEqual(resolveHomeLayout(null, CATALOG));
    expect(resolveHomeLayout({ left: ["a"] }, CATALOG)).toEqual(resolveHomeLayout(null, CATALOG)); // falta `v`
    expect(resolveHomeLayout(undefined, CATALOG)).toEqual(resolveHomeLayout(null, CATALOG));
  });

  it("`v` desconocida -> layout default", () => {
    const resolved = resolveHomeLayout({ v: 2, left: ["a"], right: [], hidden: [] }, CATALOG);
    expect(resolved).toEqual(resolveHomeLayout(null, CATALOG));
  });

  it("id desconocido del doc no se renderiza", () => {
    const resolved = resolveHomeLayout({ v: 1, left: ["a", "zzz-futuro", "b", "c"], right: ["d", "e"], hidden: [] }, CATALOG);
    expect(resolved.left).toEqual(["a", "b", "c"]);
    expect(resolved.mobile).not.toContain("zzz-futuro");
  });

  it("bloque del catálogo ausente del doc se inserta junto a su predecesor default, no al final", () => {
    // "c" nunca se guardó (p. ej. una versión vieja que no lo conocía): su
    // predecesor default es "b", así que tiene que aparecer justo después.
    const resolved = resolveHomeLayout({ v: 1, left: ["b", "a"], right: ["d", "e"], hidden: [] }, CATALOG);
    expect(resolved.left).toEqual(["b", "c", "a"]);
  });

  it("bloque ausente sin ningún predecesor presente va al head de su columna default", () => {
    const resolved = resolveHomeLayout({ v: 1, left: [], right: ["d", "e"], hidden: [] }, CATALOG);
    // "a" no tiene predecesor (es el primero de defaultLeft) -> head.
    // "b" y "c" encadenan detrás de su propio predecesor.
    expect(resolved.left).toEqual(["a", "b", "c"]);
  });

  it("duplicado entre columnas -> dedupe, hidden gana sobre la presencia en una columna", () => {
    const resolved = resolveHomeLayout({ v: 1, left: ["a", "b"], right: ["d"], hidden: ["a", "e"] }, CATALOG);
    expect(resolved.hidden).toEqual(["a", "e"]);
    expect(resolved.left).not.toContain("a");
    expect(resolved.left).toEqual(["b", "c"]);
  });

  it("duplicado entre left y right (ninguno en hidden) -> gana left", () => {
    const resolved = resolveHomeLayout({ v: 1, left: ["a", "d"], right: ["d", "e"], hidden: [] }, CATALOG);
    expect(resolved.left).toContain("d");
    expect(resolved.right).not.toContain("d");
  });

  it("bloque no disponible ahora (isAvailable=false en el caller) no se borra del doc: sigue en el resuelto", () => {
    // resolveHomeLayout no sabe nada de disponibilidad — eso lo filtra el
    // renderer. Acá solo confirmamos que el id sigue en el resultado.
    const resolved = resolveHomeLayout({ v: 1, left: ["a", "b", "c"], right: ["d", "e"], hidden: [] }, CATALOG);
    expect(resolved.right).toContain("d");
  });

  it("mobile es siempre left ++ right", () => {
    const resolved = resolveHomeLayout({ v: 1, left: ["c", "a"], right: ["e", "d"], hidden: ["b"] }, CATALOG);
    expect(resolved.mobile).toEqual([...resolved.left, ...resolved.right]);
  });
});
