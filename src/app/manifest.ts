import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * Reemplaza `public/manifest.webmanifest` (borrado) para traducir
 * `description`, el shortcut de captura y `lang` según el locale de la
 * cookie `perze_locale` (ver `src/i18n/request.ts`). El resto del manifest
 * (íconos, colores, `start_url`) no depende del idioma.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);

  return {
    id: "/",
    name: "PERZE",
    short_name: "PERZE",
    description: t("app.description"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-mono-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: t("app.shortcutAddExpense"),
        short_name: t("app.shortcutAddExpenseShort"),
        url: "/add",
        description: t("app.shortcutAddExpenseDescription"),
        icons: [
          { src: "/icons/shortcut-gasto-96.png", sizes: "96x96", type: "image/png" },
          { src: "/icons/shortcut-gasto-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
    ],
    categories: ["finance", "productivity"],
    lang: locale,
    dir: "ltr",
  };
}
