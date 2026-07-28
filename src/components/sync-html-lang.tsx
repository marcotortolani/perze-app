"use client";

import { useEffect } from "react";

/**
 * `<html lang>` se hornea como `"es"` en `layout.tsx` para no depender de
 * la cookie de locale en el shell estático (ver `intl-boundary.tsx`). Esto
 * lo corrige en el cliente para los casos EN/PT.
 */
export function SyncHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
