"use client";

import { useRouter } from "next/navigation";
import { AccountCarousel } from "@/design-system";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useHomeData } from "../home-data";

/**
 * `flexShrink: 0`: sin esto colapsaba a 0px de alto. `overflowX: "auto"` en
 * el propio carrusel hace que el navegador coaccione `overflow-y` a `auto`
 * también (misma regla CSSOM que ya rompía scroll horizontal en
 * `accounts/page.tsx`/`transactions/layout.tsx`, acá al revés) — como hijo
 * de un flex-column con `height:100%`, eso le da un `min-height` automático
 * de 0 (la regla de flexbox para ítems que son su propio contenedor de
 * scroll), así que absorbía solo TODA la presión de achique cuando el
 * contenido no entra entero, mientras sus hermanos (sin overflow propio,
 * min-height content-based) no cedían nada.
 */
export function AccountsBlock() {
  const router = useRouter();
  const { accountSummaries } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);

  return (
    <AccountCarousel
      accounts={accountSummaries}
      privacy={privacy}
      onSelect={(id) => router.push(`/accounts?account=${id}`, { scroll: false })}
      gridOnDesktop
      style={{ flexShrink: 0 }}
    />
  );
}
