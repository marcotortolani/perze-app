"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Banner, EmptyState, ErrorState, Skeleton, StatusBadge, usePageHeader } from "@/design-system";
import { Icon } from "@/design-system/core/Icon";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { ACCESS_STATUS_BADGE_STATUS, ACCESS_STATUS_MESSAGE_KEY } from "@/lib/reference/access-status";
import { useAccessRequests } from "@/hooks/use-admin-users";
import { useOwnAccess } from "@/hooks/use-own-access";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { formatNumericDate, formatRelativeDay, type Locale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import type { AccessRequest } from "@/lib/repos/admin-repo";
import { countPending, countriesOf, filterAndSortUsers, type SortDir, type SortField } from "./filter-users";
import { useAdminUsersFilters } from "./use-admin-users-filters";
import { AdminUsersControlBar } from "./AdminUsersControlBar";
import { userInitials } from "./user-monogram";

const ROW_HEIGHT_DESKTOP = 52;
const ROW_HEIGHT_MOBILE = 68;
// Con el detalle abierto la columna de lista se angosta (~504px, ver
// `SplitGrid` en `page.tsx`): País y Registrado se caen porque están a la
// vista en la ficha de al lado, y solo quedan Usuario/Estado/Actividad.
const GRID_FULL = "minmax(220px,2.4fr) minmax(110px,1fr) 116px minmax(104px,0.9fr) minmax(112px,0.9fr)";
const GRID_COMPACT = "minmax(180px,2.4fr) 116px minmax(112px,0.9fr)";
// Definición de terminado (CLAUDE.md): listas de más de 50 items
// virtualizadas. Por debajo, `.map()` plano — deja el DOM buscable con
// Ctrl+F del navegador, que en una lista corta es más útil que ahorrar nodos.
const VIRTUALIZE_THRESHOLD = 50;

type SortableColumn = Extract<SortField, "name" | "requestedAt" | "lastSeenAt">;

function Monogram({ label, size }: { label: string; size: number }) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        background: "var(--surface-2)",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 600,
      }}
    >
      {userInitials(label)}
    </span>
  );
}

function ColumnHeaderButton({
  label,
  column,
  criteria,
  onSort,
  align = "right",
}: {
  label: string;
  column: SortableColumn;
  criteria: { sort: SortField; dir: SortDir };
  onSort: (field: SortField, dir: SortDir) => void;
  align?: "left" | "right";
}) {
  const t = useTranslations();
  const active = criteria.sort === column;
  const nextDir: SortDir = active ? (criteria.dir === "asc" ? "desc" : "asc") : column === "name" ? "asc" : "desc";
  // `aria-sort` no es válido en un `<button>` (esa grilla es `display:grid`
  // sobre `div`s, no una `<table>` con `role="columnheader"`) — el estado se
  // anuncia por `aria-label` en su lugar; el chevron visual sigue siendo el
  // indicador principal para quien ve la pantalla.
  return (
    <button
      type="button"
      onClick={() => onSort(column, nextDir)}
      aria-label={t("adminPage.users.sortColumnLabel", { column: label })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: 4,
        marginLeft: align === "right" ? "auto" : 0,
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span className="t-caption" style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {label}
      </span>
      {active ? (
        <Icon name="chevron-down" size={12} color="var(--text-secondary)" style={{ transform: criteria.dir === "asc" ? "rotate(180deg)" : "none", transition: "transform var(--duration-fast)" }} />
      ) : null}
    </button>
  );
}

interface RowProps {
  user: AccessRequest;
  active: boolean;
  variant: "table" | "card";
  gridColumns: string;
  locale: Locale;
  dateFormat: "locale" | "dmy" | "mdy" | "ymd";
  onOpen: (id: string) => void;
}

function UserRow({ user, active, variant, gridColumns, locale, dateFormat, onOpen }: RowProps) {
  const t = useTranslations();
  const label = user.email ?? user.displayName ?? user.profileId;
  const countryLabel = user.country ? (user.country in COUNTRY_MESSAGE_KEY ? t(COUNTRY_MESSAGE_KEY[user.country as keyof typeof COUNTRY_MESSAGE_KEY]) : user.country) : null;
  const activity = user.lastSeenAt ? formatRelativeDay(locale, new Date(user.lastSeenAt)) : t("adminPage.users.neverConnectedShort");
  const selectionStyle = active ? { background: "var(--selection-surface)", boxShadow: "inset 0 0 0 1px var(--selection-ring)", borderRadius: "var(--radius-card)" } : undefined;

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={() => onOpen(user.profileId)}
        aria-current={active || undefined}
        aria-label={t("adminPage.users.openRow", { name: label })}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: ROW_HEIGHT_MOBILE, padding: "0 12px", background: "none", border: 0, textAlign: "left", cursor: "pointer", ...selectionStyle }}
      >
        <Monogram label={label} size={32} />
        <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "500 15px/20px var(--font-sans)", color: "var(--text-primary)" }}>{label}</span>
            <StatusBadge status={ACCESS_STATUS_BADGE_STATUS[user.accessStatus]}>{t(ACCESS_STATUS_MESSAGE_KEY[user.accessStatus] as Parameters<typeof t>[0])}</StatusBadge>
          </span>
          <span className="t-caption" style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[user.displayName, countryLabel, activity].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(user.profileId)}
      aria-current={active || undefined}
      aria-label={t("adminPage.users.openRow", { name: label })}
      style={{ display: "grid", gridTemplateColumns: gridColumns, gap: 12, width: "100%", height: ROW_HEIGHT_DESKTOP, padding: "0 12px", alignItems: "center", background: "none", border: 0, textAlign: "left", cursor: "pointer", ...selectionStyle }}
    >
      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <Monogram label={label} size={28} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "500 14px/18px var(--font-sans)", color: "var(--text-primary)" }}>{label}</span>
          {user.displayName && user.email ? <span className="t-caption" style={{ color: "var(--text-muted)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName}</span> : null}
        </span>
      </span>
      {gridColumns === GRID_FULL ? (
        <span className="t-caption" style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {countryLabel ?? "—"}
        </span>
      ) : null}
      <span>
        <StatusBadge status={ACCESS_STATUS_BADGE_STATUS[user.accessStatus]}>{t(ACCESS_STATUS_MESSAGE_KEY[user.accessStatus] as Parameters<typeof t>[0])}</StatusBadge>
      </span>
      {gridColumns === GRID_FULL ? (
        <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>{formatNumericDate(locale, new Date(user.accessRequestedAt), dateFormat)}</span>
      ) : null}
      <span style={{ textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>{activity}</span>
    </button>
  );
}

function RowSkeleton({ variant, gridColumns }: { variant: "table" | "card"; gridColumns: string }) {
  if (variant === "card") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, height: ROW_HEIGHT_MOBILE, padding: "0 12px" }}>
        <Skeleton width={32} height={32} radius={16} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="55%" height={13} />
          <Skeleton width="35%" height={11} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: 12, height: ROW_HEIGHT_DESKTOP, padding: "0 12px", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width={28} height={28} radius={14} />
        <Skeleton width="60%" height={13} />
      </div>
      {gridColumns === GRID_FULL ? <Skeleton width="70%" height={12} /> : null}
      <Skeleton width={72} height={20} radius={999} />
      {gridColumns === GRID_FULL ? <Skeleton width="60%" height={12} style={{ marginLeft: "auto" }} /> : null}
      <Skeleton width="50%" height={12} style={{ marginLeft: "auto" }} />
    </div>
  );
}

/**
 * Lista de `/more/admin/users` — barra de control + banner de pendientes +
 * header de columnas (desktop, FUERA del scroller) + filas (tabla en
 * desktop, cards de dos líneas en mobile). Reemplaza las dos secciones de
 * cards del `page.tsx` viejo.
 *
 * Virtualizada con `@tanstack/react-virtual` a partir de
 * `VIRTUALIZE_THRESHOLD` filas — patrón calcado de
 * `TransactionsListContent`, con dos diferencias deliberadas: sin
 * `measureElement` (las filas son de alto fijo, medirlas agrega jitter sin
 * comprar nada) y con un reset de `scrollTop` al cambiar los criterios de
 * filtro (sin eso, filtrar estando scrolleado abajo deja la lista pareciendo
 * vacía).
 */
export function AdminUsersListContent({ activeId }: { activeId: string | undefined }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ownAccess = useOwnAccess();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const filters = useAdminUsersFilters();
  const deferredCriteria = useDeferredValue(filters.criteria);

  usePageHeader({ title: t("adminPage.usersPageTitle"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const requestsQuery = useAccessRequests(ownAccess?.isAppAdmin === true);
  const errorState = useQueryErrorState(requestsQuery, { what: t("adminPage.users.loadError"), next: t("adminPage.users.loadErrorNext") });

  const users = requestsQuery.data;
  const pendingCount = useMemo(() => (users ? countPending(users) : 0), [users]);
  const countries = useMemo(() => (users ? countriesOf(users) : []), [users]);
  const visible = useMemo(() => (users ? filterAndSortUsers(users, deferredCriteria) : []), [users, deferredCriteria]);
  const showBanner = pendingCount > 0 && filters.criteria.status !== "pending";

  const openUser = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("user", id);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  const gridColumns = activeId ? GRID_COMPACT : GRID_FULL;
  const variant: "table" | "card" = isSplit ? "table" : "card";
  const rowHeight = isSplit ? ROW_HEIGHT_DESKTOP : ROW_HEIGHT_MOBILE;

  // --- Virtualización (a partir de VIRTUALIZE_THRESHOLD filas) ---
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollerNode, setScrollerNode] = useState<HTMLDivElement | null>(null);
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null);
  // `useCallback`, no un arrow inline: con un ref inline React lo llama con
  // `null` y con el nodo en CADA render, y con un `setState` adentro eso es
  // un loop infinito que se ve como cuelgue, no como error (mismo patrón que
  // `TransactionsListContent.scrollerRefCallback`).
  const scrollerRefCallback = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    setScrollerNode(node);
  }, []);

  // Distancia entre el origen del scroller y el arranque de la lista — vale
  // 0 salvo cuando el banner de pendientes está adentro del scroller
  // (siempre), y se MIDE porque el alto del banner depende del copy y del
  // ancho disponible.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (!scrollerNode || !listNode) return;
    const measure = () => {
      const next = listNode.getBoundingClientRect().top - scrollerNode.getBoundingClientRect().top + scrollerNode.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollerNode);
    for (const sibling of Array.from(scrollerNode.children)) {
      if (sibling !== listNode) observer.observe(sibling);
    }
    return () => observer.disconnect();
  }, [scrollerNode, listNode, showBanner]);

  const virtualized = visible.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    scrollMargin,
  });

  // Reset de scroll al cambiar los criterios — sin esto, filtrar estando
  // scrolleado abajo (fila 400 de 800, por ejemplo) deja la lista pareciendo
  // vacía: el `scrollTop` viejo sigue apuntando a una posición que ya no
  // existe en el resultado filtrado.
  const criteriaSignature = JSON.stringify(deferredCriteria);
  useEffect(() => {
    scrollerNode?.scrollTo({ top: 0 });
  }, [criteriaSignature, scrollerNode]);

  // `ownAccess === undefined`: el gating todavía no resolvió si esta
  // persona puede ver la pantalla — un skeleton, no un `EmptyState` que le
  // diría "no hay usuarios" a alguien que ni siquiera sabe si puede mirar.
  if (ownAccess === undefined) {
    return (
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <RowSkeleton key={i} variant={variant} gridColumns={GRID_FULL} />
        ))}
      </div>
    );
  }

  if (!ownAccess.isAppAdmin) return null; // redirect ya disparado por el efecto del contenedor

  const columnHeader = isSplit ? (
    <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: 12, padding: "0 12px 8px", flexShrink: 0 }}>
      <ColumnHeaderButton label={t("adminPage.users.columnUser")} column="name" criteria={filters.criteria} onSort={filters.setSort} align="left" />
      {gridColumns === GRID_FULL ? <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("adminPage.users.columnCountry")}</span> : null}
      <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("adminPage.users.columnStatus")}</span>
      {gridColumns === GRID_FULL ? <ColumnHeaderButton label={t("adminPage.users.columnRequested")} column="requestedAt" criteria={filters.criteria} onSort={filters.setSort} /> : null}
      <ColumnHeaderButton label={t("adminPage.users.columnLastSeen")} column="lastSeenAt" criteria={filters.criteria} onSort={filters.setSort} />
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, paddingTop: 12 }}>
      <AdminUsersControlBar
        criteria={filters.criteria}
        onQueryChange={filters.setQuery}
        onStatusChange={filters.setStatus}
        onCountryChange={filters.setCountry}
        onSortChange={filters.setSort}
        onClear={filters.clear}
        countries={countries}
        resultCount={visible.length}
        totalCount={users?.length ?? 0}
        showSortPill={!isSplit}
      />

      {/* Header de columnas FUERA del scroller — sin él no hay ninguna
          interacción sticky/virtualizador que resolver, y `scrollMargin`
          no necesita contarlo. Se muestra salvo con error o lista vacía
          (nada que encabezar). */}
      {!errorState && (requestsQuery.isLoading || visible.length > 0) ? columnHeader : null}

      {/* `pb-[...]`: espacio real al final para que el FAB del shell no tape
          la última fila — mismo patrón que `AccountsListContent`/
          `TransactionsListContent`, obligatorio en toda pantalla listada en
          `OWN_SCROLLER_ROUTES` (ver `(app)/layout.tsx`). */}
      <div ref={scrollerRefCallback} className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8 scroll-gutter-right" style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
        {showBanner ? (
          <Banner
            status="warning"
            message={t("adminPage.users.pendingBanner", { count: pendingCount })}
            action={{ label: t("adminPage.users.pendingBannerAction"), onClick: () => filters.setStatus("pending") }}
            style={isSplit ? { marginBottom: 12 } : { margin: "0 calc(-1 * var(--screen-padding)) 12px", borderRadius: 0 }}
          />
        ) : null}

        {/* Hijo directo SIEMPRE presente (con datos o vacío): es el nodo
            contra el que se mide `scrollMargin`, y tiene que estar para que
            el `ResizeObserver` de arriba pueda distinguirlo del banner. */}
        <div ref={setListNode}>
          {errorState ? (
            <ErrorState {...errorState} />
          ) : requestsQuery.isLoading ? (
            <>
              {Array.from({ length: 8 }, (_, i) => (
                <RowSkeleton key={i} variant={variant} gridColumns={gridColumns} />
              ))}
            </>
          ) : (users ?? []).length === 0 ? (
            <EmptyState message={t("adminPage.users.empty")} />
          ) : visible.length === 0 ? (
            <EmptyState message={t("adminPage.users.emptyFiltered")} actionLabel={t("adminPage.users.clearFilters")} onAction={filters.clear} />
          ) : virtualized ? (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const user = visible[virtualRow.index];
                if (!user) return null;
                return (
                  <div key={virtualRow.key} data-index={virtualRow.index} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start - scrollMargin}px)` }}>
                    <UserRow user={user} active={user.profileId === activeId} variant={variant} gridColumns={gridColumns} locale={locale} dateFormat={dateFormat} onOpen={openUser} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {visible.map((user) => (
                <UserRow key={user.profileId} user={user} active={user.profileId === activeId} variant={variant} gridColumns={gridColumns} locale={locale} dateFormat={dateFormat} onOpen={openUser} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE };
