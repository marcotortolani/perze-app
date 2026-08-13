"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/design-system";
import { Modal } from "@/components/modal";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useOwnAccess } from "@/hooks/use-own-access";
import { useAccessRequest } from "@/hooks/use-admin-users";
import { AdminUsersListContent } from "./AdminUsersListContent";
import { AdminUserDetailContent } from "./AdminUserDetailContent";

// TODO(admin-users): `SplitGrid`/`DetailHeaderBridge` se duplican por
// TERCERA vez (ya están en `accounts/page.tsx` y `transactions/page.tsx`,
// y no son idénticas entre sí). No se extraen en este PR — "un bloque, una
// rama, un PR" (CLAUDE.md) y extraer ahora sería un cambio de comportamiento
// en dos pantallas ya estables sin un cuarto consumidor contra el que
// validar la API resultante. Extraer a `src/components/split/SplitGrid.tsx`
// + `DetailHeaderBridge.tsx` cuando exista un consumidor #4.
function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,504px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
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
 * Registra el header del shell para el detalle abierto en desktop. Montado
 * DESPUÉS de la lista en el JSX (`AdminUsersListContent` también llama
 * `usePageHeader`, sin cleanup — gana el último efecto en correr, ver
 * `design-system/nav/page-header-context.tsx`). En mobile no se monta: el
 * detalle va adentro de `Modal`, que dibuja su propio botón de volver.
 */
function DetailHeaderBridge({ title, backLabel, onClose }: { title: string | undefined; backLabel: string; onClose: () => void }) {
  usePageHeader({ onBack: onClose, backLabel, ...(title ? { title } : {}) });
  return null;
}

/**
 * Gestión de usuarios del operador — lista con búsqueda/filtro/orden +
 * detalle por `?user=<id>`, mismo patrón master-detail que `/accounts` y
 * `/transactions` (CLAUDE.md § convención de rutas). Reemplaza las dos
 * secciones de cards ("Solicitudes pendientes" + "Todos los usuarios") que
 * vivían acá antes — ver el plan de rediseño en `docs/` para el detalle.
 */
export default function AdminUsersPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const ownAccess = useOwnAccess();

  useEffect(() => {
    if (ownAccess !== undefined && !ownAccess.isAppAdmin) router.replace("/");
  }, [ownAccess, router]);

  const userId = searchParams.get("user");
  // Misma query key que usa el detalle (`useAccessRequest` — `select` sobre
  // la lista completa ya cargada): sale del cache, no es un fetch extra.
  const { data: selectedUser } = useAccessRequest(userId ?? undefined, !!userId);

  const list = <AdminUsersListContent activeId={userId ?? undefined} />;
  const closeDetail = () => router.back();

  if (!isSplit) {
    // Mobile: `Modal contained` ya dibuja su propio botón de volver, así
    // que el detalle no necesita el suyo — sin `key={userId}` no hay
    // `onClose` de más.
    const detail = userId ? <AdminUserDetailContent key={userId} id={userId} /> : null;
    return (
      <>
        {list}
        {detail ? <Modal contained>{detail}</Modal> : null}
      </>
    );
  }

  // Desktop sin selección: la tabla ocupa el ancho completo — una columna
  // de detalle vacía (solo con el prompt "elegí un usuario") le resta
  // espacio a la tabla sin aportar nada mientras no hay nadie elegido. El
  // split recién aparece cuando `userId` existe, y por eso `DetailPanelTransition`
  // no hace falta acá: no hay nada que animar entre "sin selección" y "sin
  // selección", el cambio real es entrar/salir de este layout entero.
  if (!userId) return list;

  // `key`: al cambiar de usuario se remonta el detalle, así el estado
  // local (`acting`) no se arrastra de una ficha a la otra. `onClose`:
  // botón propio en el panel — la flecha del header lee como "salir de
  // Usuarios", no como "cerrar esta ficha", y hace lo mismo (`router.back()`).
  const detail = <AdminUserDetailContent key={userId} id={userId} onClose={closeDetail} />;

  return (
    <>
      <SplitGrid left={list} right={detail} overflowing={overflowing} detailScrollerRef={detailScrollerRef} />
      <DetailHeaderBridge title={selectedUser ? (selectedUser.email ?? selectedUser.displayName ?? undefined) : undefined} backLabel={t("adminPage.users.detail.back")} onClose={closeDetail} />
    </>
  );
}
