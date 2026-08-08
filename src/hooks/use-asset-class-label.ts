"use client";

import { useTranslations } from "next-intl";
import { assetClassLabelKey } from "@/lib/investments/asset-class-labels";
import type { AssetClass } from "@/lib/repos/instruments-repo";

/**
 * Nombre a MOSTRAR de una clase de activo: traducido si es una fila global
 * (`householdId === null`, plantilla sembrada en español), literal si es
 * propia del household (clonada o creada a mano — dato real del usuario,
 * nunca se traduce). Nunca usar para `decimalsForQuantity`/matching de
 * `assetClassId`, que necesitan el nombre canónico sin traducir — para eso
 * seguí leyendo `assetClass.name` directo, no el resultado de este hook.
 */
export function useAssetClassLabel() {
  const t = useTranslations();
  return (assetClass: Pick<AssetClass, "name" | "householdId"> | null | undefined): string | undefined => {
    if (!assetClass) return undefined;
    if (assetClass.householdId !== null) return assetClass.name;
    const key = assetClassLabelKey(assetClass.name);
    return key ? t(`assetClassLabels.${key}`) : assetClass.name;
  };
}
