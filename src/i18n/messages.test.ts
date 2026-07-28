import { describe, expect, it } from "vitest";
import es from "../../messages/es.json";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key));
}

/**
 * ES es el idioma fuente (ver `src/i18n/routing.ts`) — EN y PT tienen que
 * tener exactamente el mismo árbol de claves, ni de más ni de menos, para
 * que `useTranslations`/`getTranslations` nunca caiga a un string sin
 * traducir en producción.
 */
describe("paridad de claves entre messages/{es,en,pt}.json", () => {
  const esKeys = new Set(flattenKeys(es));

  it.each([
    ["en", en],
    ["pt", pt],
  ])("%s tiene exactamente las mismas claves que es", (_locale, dictionary) => {
    const keys = new Set(flattenKeys(dictionary));
    const missing = [...esKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !esKeys.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});
