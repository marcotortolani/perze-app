import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export const LOCALE_COOKIE = "perze_locale";

type Locale = (typeof routing.locales)[number];

function isSupportedLocale(value: string | undefined): value is Locale {
  return routing.locales.includes(value as Locale);
}

/**
 * Sin cookie (primera visita) negociamos por `Accept-Language` en vez de
 * caer directo a `defaultLocale` — evita mostrar español de entrada a un
 * usuario cuyo navegador pide inglés o portugués.
 */
function negotiateFromAcceptLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  const requested = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter((tag): tag is string => Boolean(tag));

  for (const tag of requested) {
    const primary = tag.split("-")[0];
    if (isSupportedLocale(primary)) return primary;
  }

  return null;
}

export default getRequestConfig(async () => {
  const [store, headerList] = await Promise.all([cookies(), headers()]);
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  const locale = isSupportedLocale(cookieLocale)
    ? cookieLocale
    : (negotiateFromAcceptLanguage(headerList.get("accept-language")) ?? routing.defaultLocale);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
