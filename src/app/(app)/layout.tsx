"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Sidebar, TabBar, type TabItem, type SidebarNavGroup } from "@/design-system";
import { useNavStore } from "@/stores/nav-store";
import { useScopeStore } from "@/stores/scope-store";
import { usePendingMutations } from "@/lib/offline";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useBudgetAlerts } from "@/hooks/use-budget-alerts";
import { SAW_WELCOME_KEY } from "@/lib/onboarding/welcome-flag";
import { PinGate } from "@/components/pin-gate";
import { SearchOverlay } from "@/components/search-overlay";
import { buildDesktopNav, activeNavId } from "@/lib/nav/desktop-nav";
import { contentWidthFor } from "@/lib/nav/content-width";

const ROUTE_TO_TAB: Record<string, string> = {
  "/": "home",
  "/transactions": "movements",
  "/more": "more",
};

/**
 * Shell de la app: header de 56px + contenido + tab bar de 64px con el
 * FAB central. Tres slots fijos, uno elegido por el usuario (K3, default
 * Análisis) — `docs/02-design-system.md` § 8. La navegación nunca se
 * reconfigura sola.
 *
 * Responsive: a partir de `md` la TabBar inferior se oculta y aparece un
 * `Sidebar` fijo a la izquierda (mismos tabs, mismo handler); el contenido
 * queda centrado en una sola columna de `--content-max-width` en cualquier
 * tamaño — nunca multi-columna.
 */
const SCOPE_ORDER = ["personal", "household", "all"] as const;

export default function AppShellLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fourthTab = useNavStore((s) => s.fourthTab);
  const scope = useScopeStore((s) => s.scope);
  const setScope = useScopeStore((s) => s.setScope);
  const pending = usePendingMutations();
  const online = useOnlineStatus();
  const { data: household, isLoading: householdLoading } = useCurrentHousehold();
  const budgetAlerts = useBudgetAlerts();
  const [searchOpen, setSearchOpen] = useState(false);

  // Deep link `/?search=1` — usado por el redirect de `/search` (viejo
  // punto de entrada, e2e y shortcuts de PWA lo siguen apuntando ahí) y
  // por cualquier link externo que quiera abrir el buscador directamente.
  useEffect(() => {
    if (searchParams.get("search") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización genuina con el querystring de un deep link, no derivable en el render.
    setSearchOpen(true);
    const params = new URLSearchParams(searchParams);
    params.delete("search");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, pathname, router]);

  // Atajo de escritorio ⌘K/Ctrl+K — antes vivía en `command-palette.tsx`,
  // ahora unificado con el buscador flotante.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const desktopNav = useMemo(() => buildDesktopNav({ enabledModules: household?.enabledModules ?? [] }), [household?.enabledModules]);
  const navGroups = useMemo<SidebarNavGroup[]>(
    () =>
      desktopNav.map((group) => ({
        id: group.id,
        // `labelKey`/`captionKey` vienen de `desktop-nav.ts`, un módulo de
        // datos puro que no tipa contra las claves de next-intl (a
        // diferencia de los `Record<Kind, string> as const satisfies ...`
        // que sí lo hacen, ver `account-kind-labels.ts`) — cast explícito,
        // no un `as any` general.
        caption: group.captionKey ? t(group.captionKey as Parameters<typeof t>[0]) : undefined,
        items: group.items.map((item) => ({ id: item.id, route: item.route, icon: item.icon, label: t(item.labelKey as Parameters<typeof t>[0]) })),
      })),
    [desktopNav, t]
  );
  const activeDesktopId = useMemo(() => activeNavId(pathname, desktopNav), [pathname, desktopNav]);

  // Sin household todavía: A1 (welcome) solo en la primera apertura sin
  // sesión; después, directo a A2. `(app)/layout.tsx` es el único punto de
  // entrada de todo el shell, así que acá es donde corresponde el gate.
  useEffect(() => {
    if (householdLoading || household !== null) return;
    const sawWelcome = typeof window !== "undefined" && window.localStorage.getItem(SAW_WELCOME_KEY);
    router.replace(sawWelcome ? "/onboarding" : "/onboarding/welcome");
  }, [household, householdLoading, router]);

  if (!householdLoading && household === null) return null;

  const fourthTabRoute: Record<string, { path: string; item: TabItem }> = {
    analytics: { path: "/analytics", item: { id: "analytics", label: t("nav.analysis"), icon: "chart" } },
    accounts: { path: "/accounts", item: { id: "accounts", label: t("nav.accounts"), icon: "wallet" } },
    investments: { path: "/investments", item: { id: "investments", label: t("nav.investments"), icon: "invest" } },
    budgets: {
      path: "/budgets",
      item: {
        id: "budgets",
        label: t("nav.budgets"),
        icon: "target",
        ...(budgetAlerts.length > 0 ? { badge: budgetAlerts.length, badgeLabel: t("ds.tabBar.budgetAlertsBadge", { count: budgetAlerts.length }) } : {}),
      },
    },
  };
  const fourth = fourthTabRoute[fourthTab] ?? fourthTabRoute.analytics!;
  const tabs: TabItem[] = [
    { id: "home", label: t("nav.homeShort"), icon: "home" },
    { id: "movements", label: t("nav.movementsShort"), icon: "list" },
    { id: "add", label: "", icon: "plus", fab: true },
    fourth.item,
    { id: "more", label: t("nav.more"), icon: "more" },
  ];

  const activeTab = ROUTE_TO_TAB[pathname] ?? (pathname === fourth.path ? fourth.item.id : "");

  const scopeLabels: Record<(typeof SCOPE_ORDER)[number], string> = {
    personal: t("nav.scope.personal"),
    household: t("nav.scope.shared"),
    all: t("nav.scope.all"),
  };
  const scopeOptions = SCOPE_ORDER.map((id) => scopeLabels[id]);
  const scopeLabel = scopeLabels[scope];
  const handleScopeChange = (label: string) => {
    const id = SCOPE_ORDER.find((candidate) => scopeLabels[candidate] === label);
    if (id) setScope(id);
  };

  const handleTabChange = (id: string) => {
    if (id === "add") {
      router.push("/add");
      return;
    }
    if (id === "home") router.push("/");
    else if (id === "movements") router.push("/transactions");
    else if (id === "more") router.push("/more");
    else if (id === fourth.item.id) router.push(fourth.path);
  };

  const maxWidth = `var(${contentWidthFor(pathname) === "wide" ? "--content-max-width-wide" : "--content-max-width"})`;

  return (
    <PinGate>
    <div className="app-shell">
      <Sidebar
        tabs={tabs}
        groups={navGroups}
        active={activeDesktopId ?? undefined}
        onNavigate={(route) => router.push(route)}
        onAdd={() => router.push("/add")}
        className="hidden lg:flex"
      />
      <div className="app-shell-column">
        <div className="mx-auto w-full" style={{ maxWidth }}>
          <AppHeader
            scope={scopeLabel}
            onScopeChange={handleScopeChange}
            scopeOptions={scopeOptions}
            onSearch={() => setSearchOpen(true)}
            searchExpanded={searchOpen}
            searchLabel={t("ds.appHeader.search")}
            syncState={!online ? "offline" : pending && pending > 0 ? "syncing" : "synced"}
            pending={pending ?? 0}
          />
        </div>
        <main className="app-shell-main pb-[calc(var(--tabbar-height)+24px)] lg:pb-6">
          {/* `height: 100%` — Movimientos (D1) usa `height: "100%"` en su
              virtualizador y necesita que este contenedor tenga una altura
              definida para resolverlo, no solo `flex: 1` en el ancestro.
              Sin `position: relative` a propósito: los `<Sheet>` de estas
              pantallas (filtros, FxEditor, etc.) ya se probaron cubriendo
              todo el viewport (`inset: 0` contra el initial containing
              block) — no lo cambiamos acá para no correr esa regresión. */}
          <div className="mx-auto w-full" style={{ maxWidth, height: "100%" }}>
            {children}
          </div>
        </main>
        <div className="lg:hidden" style={{ flexShrink: 0 }}>
          <TabBar tabs={tabs} active={activeTab} onChange={handleTabChange} />
        </div>
      </div>
      {modal}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
    </PinGate>
  );
}
