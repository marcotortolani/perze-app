"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Sidebar, TabBar, type TabItem } from "@/design-system";
import { useNavStore } from "@/stores/nav-store";
import { useScopeStore } from "@/stores/scope-store";
import { usePendingMutations } from "@/lib/offline";

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
  const fourthTab = useNavStore((s) => s.fourthTab);
  const scope = useScopeStore((s) => s.scope);
  const setScope = useScopeStore((s) => s.setScope);
  const pending = usePendingMutations();

  const fourthTabRoute: Record<string, { path: string; item: TabItem }> = {
    analytics: { path: "/analytics", item: { id: "analytics", label: t("nav.analysis"), icon: "chart" } },
    accounts: { path: "/accounts", item: { id: "accounts", label: t("nav.accounts"), icon: "wallet" } },
    investments: { path: "/investments", item: { id: "investments", label: t("nav.investments"), icon: "invest" } },
    budgets: { path: "/budgets", item: { id: "budgets", label: t("nav.budgets"), icon: "target" } },
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

  return (
    <div style={{ display: "flex", minHeight: "100svh" }}>
      <Sidebar tabs={tabs} active={activeTab} onChange={handleTabChange} onAdd={() => router.push("/add")} className="hidden md:flex" />
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100svh", flex: 1, minWidth: 0 }}>
        <div className="mx-auto w-full" style={{ maxWidth: "var(--content-max-width)" }}>
          <AppHeader
            scope={scopeLabel}
            onScopeChange={handleScopeChange}
            scopeOptions={scopeOptions}
            onSearch={() => router.push("/search")}
            searchLabel={t("ds.appHeader.search")}
            syncState={pending && pending > 0 ? "offline" : "synced"}
            pending={pending ?? 0}
          />
        </div>
        <main
          className="pb-[calc(var(--tabbar-height)+24px)] md:pb-6"
          style={{ flex: 1, paddingLeft: "var(--screen-padding)", paddingRight: "var(--screen-padding)" }}
        >
          {/* `height: 100%` — Movimientos (D1) usa `height: "100%"` en su
              virtualizador y necesita que este contenedor tenga una altura
              definida para resolverlo, no solo `flex: 1` en el ancestro.
              Sin `position: relative` a propósito: los `<Sheet>` de estas
              pantallas (filtros, FxEditor, etc.) ya se probaron cubriendo
              todo el viewport (`inset: 0` contra el initial containing
              block) — no lo cambiamos acá para no correr esa regresión. */}
          <div className="mx-auto w-full" style={{ maxWidth: "var(--content-max-width)", height: "100%" }}>
            {children}
          </div>
        </main>
        <div className="md:hidden" style={{ position: "sticky", bottom: 0 }}>
          <TabBar tabs={tabs} active={activeTab} onChange={handleTabChange} />
        </div>
      </div>
      {modal}
    </div>
  );
}
