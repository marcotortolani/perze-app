"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, IconButton, usePageHeader } from "@/design-system";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useHomeLayout } from "@/hooks/use-home-layout";
import { DEFAULT_LEFT_COLUMN, DEFAULT_RIGHT_COLUMN, HOME_BLOCK_REGISTRY, HOME_LAYOUT_CATALOG } from "./blocks/registry";
import { resolveHomeLayout } from "./layout/resolve-layout";
import type { StoredHomeLayoutDoc } from "./layout/types";
import { useHomeData } from "./home-data";

const HomeLayoutEditor = dynamic(() => import("./edit/HomeLayoutEditor"), { ssr: false, loading: () => null });

/**
 * Renderer de los bloques del home. Fuera del modo edición pinta el orden
 * GUARDADO (`useHomeLayout().doc`, resuelto contra el catálogo) — no el
 * default hardcodeado — tanto en desktop como en mobile, que es el
 * requisito central del feature: lo elegido en desktop se ve en mobile.
 * En modo edición (solo desktop) reemplaza el contenido por el editor
 * lazy-loaded, que SÍ importa `@dnd-kit`.
 */
export function HomeBlocksLayout() {
  const t = useTranslations();
  const data = useHomeData();
  const isDesktop = useIsDesktop(SPLIT_BREAKPOINT);
  const { doc, save } = useHomeLayout();
  const [editing, setEditing] = useState(false);
  const [workingDoc, setWorkingDoc] = useState<StoredHomeLayoutDoc>(null);

  // Achicar la ventana en pleno modo edición no puede dejar la pantalla
  // trabada: el editor solo existe en desktop, así que si el viewport cae
  // por debajo del breakpoint hay que salir (sin guardar el borrador).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización genuina con `matchMedia` (evento externo): `editing` no es derivable de `isDesktop` en el render, lo decide el click del usuario.
    if (!isDesktop && editing) setEditing(false);
  }, [isDesktop, editing]);

  const enterEditing = () => {
    setWorkingDoc(doc);
    setEditing(true);
  };
  const doneEditing = () => {
    save(workingDoc);
    setEditing(false);
  };

  const headerRight = useMemo(() => {
    if (!isDesktop) return undefined;
    return editing ? (
      <Button size="sm" variant="ghost" fullWidth={false} onClick={doneEditing}>
        {t("home.customize.done")}
      </Button>
    ) : (
      <IconButton icon="edit" ariaLabel={t("home.customize.enter")} onClick={enterEditing} />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enterEditing/doneEditing cierran sobre `doc`/`workingDoc`, que SÍ están en las deps de abajo vía `editing`/`doc`.
  }, [isDesktop, editing, doc, workingDoc, t]);

  usePageHeader({ title: t("nav.home"), right: headerRight });

  const { showBirthdayBanner, pending, conflicts, showReminderBanner } = data;
  const gridStyle = { gap: 28, marginTop: showBirthdayBanner || (pending && pending > 0) || conflicts.length > 0 || showReminderBanner ? 28 : 0 };

  if (editing && isDesktop) {
    // Sin wrapper `grid-cols-2` acá afuera: `HomeLayoutEditor` ya arma su
    // propia grilla de dos columnas adentro. Envolverlo en OTRA grilla de
    // dos columnas lo dejaba como el único hijo de la primera —
    // auto-ubicado en la columna 1, con la mitad derecha de la pantalla
    // vacía y las dos columnas reales del editor apretadas en la mitad
    // izquierda (un cuarto del ancho cada una).
    return <HomeLayoutEditor doc={workingDoc} onChange={setWorkingDoc} style={gridStyle} />;
  }

  const resolved = resolveHomeLayout(doc, HOME_LAYOUT_CATALOG);

  return (
    // Desktop ancho (`xl`, 1280px — `SPLIT_BREAKPOINT`, la misma que ya
    // usan `/accounts` y `/transactions` para su split de lista+detalle
    // por el mismo motivo): dos columnas para aprovechar el ancho de
    // `--content-max-width-wide` (el ancho único de toda la app — ver
    // `(app)/layout.tsx`) en vez de una sola columna de lectura angosta.
    // NO `lg` (1024px): ahí el sidebar ya ocupa su espacio, y partir en 2
    // columnas AL MISMO TIEMPO dejaba el bento de cuentas apretado en
    // media página real (~350-400px) — muy poco para que sus cards no
    // desborden. Entre 1024 y 1279px el home queda en 1 sola columna con
    // todo el ancho de contenido disponible; recién a 1280px se parte. En
    // mobile (`grid-cols-1`) es el mismo orden vertical de siempre: el
    // grid de una sola columna ignora los `gridColumn` de más abajo, así
    // que el orden final es `resolved.mobile` = `left ++ right`.
    <div className="grid grid-cols-1 xl:grid-cols-2" style={gridStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        {resolved.left.filter((id) => HOME_BLOCK_REGISTRY[id].isAvailable(data)).map((id) => {
          const { Component } = HOME_BLOCK_REGISTRY[id];
          return <Component key={id} />;
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        {resolved.right.filter((id) => HOME_BLOCK_REGISTRY[id].isAvailable(data)).map((id) => {
          const { Component } = HOME_BLOCK_REGISTRY[id];
          return <Component key={id} />;
        })}
      </div>
    </div>
  );
}

// Reexportados para que otros módulos (skeleton, tests) puedan referirse
// al layout default sin importar `registry.ts` directo.
export { DEFAULT_LEFT_COLUMN, DEFAULT_RIGHT_COLUMN };
