import { defineRouting } from "next-intl/routing";

/**
 * PERZE no usa locale-based routing: el idioma es una preferencia de cuenta
 * (ver docs/03-prompts-wireframes.md § K3), no un segmento de URL. El locale
 * se resuelve desde una cookie en `src/i18n/request.ts`.
 *
 * ES rioplatense es el idioma fuente: todo el copy del design system
 * (`perze-design/PERZE-Design-System/readme.md` § CONTENT FUNDAMENTALS) se
 * escribe primero en `messages/es.json` y se traduce desde ahí.
 */
export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "never",
});
