"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, usePageHeader } from "@/design-system";
import { Modal } from "@/components/modal";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useAccount } from "@/hooks/use-accounts";
import { AccountsListContent } from "./AccountsListContent";
import { AccountDetailContent } from "./AccountDetailContent";

function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,504px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda pegada contra el borde del contenido — ver la misma nota en `transactions/layout.tsx`.
          `minWidth: 0`: sin esto el ítem de grid vale `min-width: auto` y su
          ancho intrínseco (una cifra héroe larga, el chart) podía forzarlo
          más ancho que el track — y `overflow-y: auto` sin un `overflow-x`
          explícito activa `overflow-x: auto` implícito por regla de CSSOM
          (spec de `overflow`), de ahí el scroll horizontal. `overflowX:
          hidden` lo cierra del todo: el contenido de esta columna siempre
          tiene que entrar en su ancho. Tope subido un 20% (420 → 504). */}
      {/* `scroll-fade-bottom` en un wrapper propio (no en el scroller): el
          scroller de abajo ya tiene `overflowY:auto` sin `position:relative`
          propio, pero el patrón se mantiene igual que en la lista — el fade
          necesita un contenedor no-scrolleable como containing block.
          `paddingBottom: 32` adentro del scroller: aire real al final para
          el fade, mismo criterio que el resto. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, maxWidth: 504, minHeight: 0 } as CSSProperties}>
        <div
          ref={detailScrollerRef}
          style={{
            minWidth: 0,
            height: "100%",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            borderLeft: "1px solid var(--border)",
            paddingLeft: 32,
            paddingRight: 12,
            paddingBottom: 32,
          }}
        >
          {right}
        </div>
      </div>
    </div>
  );
}

/**
 * Registra el header del shell para el detalle abierto en desktop (título =
 * nombre de la cuenta, más el botón de volver que la deselecciona).
 *
 * Vive en un componente propio, montado solo cuando corresponde, porque
 * `usePageHeader` no se puede llamar condicionalmente y porque
 * `AccountsListContent` también lo llama: los dos escriben el mismo config en
 * cada render, sin cleanup (ver `design-system/nav/page-header-context.tsx`),
 * así que gana el último efecto en correr. Montado DESPUÉS de la lista en el
 * JSX, ese último es este — que es lo que se quiere cuando hay una cuenta
 * seleccionada. En mobile no se monta: ahí el detalle va adentro de `Modal`,
 * que tapa el header del shell y dibuja su propio botón de volver.
 */
function DetailHeaderBridge({ title, backLabel, onClose }: { title: string | undefined; backLabel: string; onClose: () => void }) {
  usePageHeader({ onBack: onClose, backLabel, ...(title ? { title } : {}) });
  return null;
}

/**
 * E1 + E2 — lista de cuentas y detalle de la cuenta seleccionada.
 *
 * El detalle se selecciona con un search param (`/accounts?account=<id>`),
 * NO con una ruta propia. Antes era `/accounts/[id]` interceptado por un slot
 * paralelo `@detail`, y eso traía dos problemas:
 *
 * 1. Next.js 16 tiene un bug abierto (vercel/next.js#91265) por el que las
 *    rutas interceptoras acumulan un marcador `(.)` en cada actualización de
 *    HMR. Después de un rato de desarrollo la ruta quedaba como
 *    `/accounts/(.)(.)…(.)<uuid>`, el server tiraba `Invalid interception
 *    route` y Next forzaba una recarga completa de página — que es lo que se
 *    veía como "la UI da un golpe al cambiar de cuenta" y, encadenado, como
 *    un spinner de carga en loop del que no se salía sin recargar a mano.
 * 2. Seleccionar una cuenta era una navegación de ruta, con todo el
 *    desmontaje de layout que eso implica, aunque visualmente solo cambiara
 *    una columna.
 *
 * Con un param, seleccionar una cuenta es un cambio de estado en la misma
 * pantalla: la lista nunca se desmonta (conserva su scroll) y no hay ninguna
 * ruta interceptora que pueda acumular nada.
 *
 * Se abre con `push` (no `replace`) para que el botón atrás del navegador —y
 * el de Android en la PWA— cierre el detalle, que es el gesto con el que la
 * gente espera cerrarlo. Cerrar es siempre `router.back()`, simétrico.
 */
export default function AccountsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();

  const accountId = searchParams.get("account");
  // Misma query key que usa el detalle — sale del cache, no es un fetch extra.
  const { data: account } = useAccount(accountId ?? undefined);

  const list = <AccountsListContent activeId={accountId ?? undefined} />;
  // `key`: al cambiar de cuenta se remonta el detalle, así el estado local
  // (el sheet de pagar tarjeta) no se arrastra de una cuenta a la otra.
  const detail = accountId ? <AccountDetailContent key={accountId} id={accountId} /> : null;

  if (!isSplit) {
    return (
      <>
        {list}
        {detail ? <Modal contained>{detail}</Modal> : null}
      </>
    );
  }

  return (
    <>
      <SplitGrid
        left={list}
        right={detail ?? <EmptyState message={t("accountsPage.detail.selectPrompt")} />}
        overflowing={overflowing}
        detailScrollerRef={detailScrollerRef}
      />
      {accountId ? <DetailHeaderBridge title={account?.name} backLabel={t("accountsPage.detail.back")} onClose={() => router.back()} /> : null}
    </>
  );
}
