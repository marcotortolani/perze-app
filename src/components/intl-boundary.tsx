import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SyncHtmlLang } from "./sync-html-lang";

/**
 * El locale sale de una cookie (`src/i18n/request.ts`), que es lectura
 * dinámica no cacheada. Con `cacheComponents: true` eso tiene que vivir
 * detrás de un `<Suspense>` — ver el árbol en `layout.tsx` — así el shell
 * estático (por ejemplo `/_not-found`, que Next intenta prerenderizar)
 * no se bloquea por esta lectura.
 */
export async function IntlBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SyncHtmlLang locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
