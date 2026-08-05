"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/design-system";
import { Modal } from "@/components/modal";
import { DetailPanelTransition } from "@/components/motion";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { MovementsListContent } from "./TransactionsListContent";
import { TransactionDetailContent } from "./TransactionDetailContent";
import { TransactionsDetailEmpty } from "./TransactionsDetailEmpty";

function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda
          pegada contra el borde del contenido (a diferencia de la lista de
          la izquierda, que hereda el `padding-inline` de `<main>` — esta
          columna no tiene ningún padding propio del lado derecho).
          `minWidth: 0` + `overflowX: hidden`: mismo fix que
          `accounts/page.tsx` — sin `minWidth: 0` el ítem de grid vale
          `min-width: auto` y el contenido (una cifra larga, un chart)
          podía forzarlo más ancho que `minmax(340px,420px)`, y
          `overflow-y: auto` sin `overflow-x` explícito activa
          `overflow-x: auto` implícito por la propia regla de `overflow`. */}
      {/* `scroll-fade-bottom` en un wrapper propio — mismo patrón que
          `accounts/page.tsx`. `paddingBottom: 32` adentro del scroller:
          aire real al final para el fade. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, maxWidth: 420, minHeight: 0 } as CSSProperties}>
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
 * Registra el header del shell para el detalle abierto en desktop (el botón
 * de volver, que deselecciona el movimiento).
 *
 * Vive en un componente propio, montado solo cuando corresponde, porque
 * `usePageHeader` no se puede llamar condicionalmente y porque
 * `MovementsListContent` también lo llama: los dos escriben el mismo config en
 * cada render, sin cleanup (ver `design-system/nav/page-header-context.tsx`),
 * así que gana el último efecto en correr. Montado DESPUÉS de la lista en el
 * JSX, ese último es este — que es lo que se quiere cuando hay un movimiento
 * seleccionado. En mobile no se monta: ahí el detalle va adentro de `Modal`,
 * que tapa el header del shell y dibuja su propio botón de volver.
 */
function DetailHeaderBridge({ backLabel, onClose }: { backLabel: string; onClose: () => void }) {
  usePageHeader({ onBack: onClose, backLabel });
  return null;
}

/**
 * D1/D2 + D3 — lista de movimientos y detalle del movimiento seleccionado.
 *
 * El detalle se selecciona con un search param (`/transactions?tx=<id>`), NO
 * con una ruta propia. Antes era `/transactions/[id]` interceptado por un slot
 * paralelo `@detail`, con los mismos dos problemas que ya se corrigieron en
 * `/accounts` (ver la nota larga en `accounts/page.tsx`):
 *
 * 1. Next.js 16 tiene un bug abierto (vercel/next.js#91265) por el que las
 *    rutas interceptoras acumulan un marcador `(.)` en cada actualización de
 *    HMR, hasta que el server tira `Invalid interception route` y fuerza una
 *    recarga completa de página.
 * 2. Y, con o sin ese bug, elegir un movimiento era una navegación de ruta
 *    —con el desmontaje de layout que eso implica— aunque visualmente solo
 *    cambiara una columna. Pasar de un movimiento a otro parpadeaba.
 *
 * Con un param, elegir un movimiento es un cambio de estado en la misma
 * pantalla: la lista nunca se desmonta (conserva su scroll y sus filtros) y no
 * hay ninguna ruta interceptora que pueda acumular nada.
 *
 * Editar sigue siendo una ruta de verdad (`/transactions/[id]/edit`), igual
 * que en cuentas: es una pantalla completa, no una selección.
 *
 * Se abre con `push` (no `replace`) para que el botón atrás del navegador —y
 * el de Android en la PWA— cierre el detalle. Cerrar es siempre
 * `router.back()`, simétrico.
 */
export default function MovementsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();

  const txId = searchParams.get("tx");

  const list = <MovementsListContent />;
  // `key`: al cambiar de movimiento se remonta el detalle, así el estado local
  // (el sheet de resolver cotización) no se arrastra de uno al otro.
  const detail = txId ? <TransactionDetailContent key={txId} id={txId} /> : null;

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
        right={
          <DetailPanelTransition transitionKey={txId ?? "__empty"}>
            {detail ?? <TransactionsDetailEmpty />}
          </DetailPanelTransition>
        }
        overflowing={overflowing}
        detailScrollerRef={detailScrollerRef}
      />
      {txId ? <DetailHeaderBridge backLabel={t("transactions.detail.back")} onClose={() => router.back()} /> : null}
    </>
  );
}
