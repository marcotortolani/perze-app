import type { IconName } from "@/design-system";

export interface NavItem {
  id: string;
  route: string;
  icon: IconName;
  labelKey: string;
}

export interface NavGroup {
  id: string;
  captionKey?: string;
  items: NavItem[];
}

/**
 * Navegación de escritorio (Sidebar) — a diferencia del `tabs` de 5 slots
 * que comparten `TabBar`/móvil, en escritorio hay alto de sobra para
 * mostrar todo. Misma taxonomía que `/more/page.tsx` (Dinero / Personas /
 * Sistema) para que el producto tenga una sola jerarquía, no dos que
 * puedan divergir. Los módulos apagados directamente no aparecen — mismos
 * predicados que `more/page.tsx`.
 */
export function buildDesktopNav(input: { enabledModules: string[] }): NavGroup[] {
  const modules = input.enabledModules;
  const groups: NavGroup[] = [
    {
      id: "primary",
      items: [
        { id: "home", route: "/", icon: "squares-four", labelKey: "nav.home" },
        { id: "movements", route: "/transactions", icon: "list", labelKey: "nav.movements" },
        { id: "analytics", route: "/analytics", icon: "chart", labelKey: "nav.analysis" },
        { id: "accounts", route: "/accounts", icon: "wallet", labelKey: "nav.accounts" },
      ],
    },
    {
      id: "money",
      captionKey: "ds.sidebar.money",
      items: [
        ...(modules.includes("budgets") ? [{ id: "budgets", route: "/budgets", icon: "target" as IconName, labelKey: "morePage.budgets" }] : []),
        ...(modules.includes("goals") ? [{ id: "goals", route: "/goals", icon: "flag" as IconName, labelKey: "morePage.goals" }] : []),
        ...(modules.includes("recurring") ? [{ id: "recurring", route: "/recurring", icon: "refresh" as IconName, labelKey: "morePage.recurring" }] : []),
        ...(modules.includes("debts") ? [{ id: "debts", route: "/debts", icon: "handshake" as IconName, labelKey: "morePage.debts" }] : []),
        ...(modules.includes("investments") ? [{ id: "investments", route: "/investments", icon: "invest" as IconName, labelKey: "nav.investments" }] : []),
        { id: "categories", route: "/more/categories", icon: "tag", labelKey: "morePage.categories" },
        { id: "tags", route: "/more/tags", icon: "tag", labelKey: "morePage.tagsAndPayees" },
        { id: "rules", route: "/more/rules", icon: "refresh", labelKey: "morePage.rules" },
      ],
    },
    ...(modules.includes("family")
      ? [
          {
            id: "people",
            captionKey: "ds.sidebar.people",
            items: [{ id: "family", route: "/family", icon: "users" as IconName, labelKey: "morePage.family" }],
          },
        ]
      : []),
    {
      id: "system",
      captionKey: "ds.sidebar.system",
      items: [
        { id: "profile", route: "/more/profile", icon: "user", labelKey: "morePage.profile" },
        { id: "security", route: "/more/security", icon: "lock", labelKey: "morePage.security" },
        { id: "notifications", route: "/more/notifications", icon: "alert", labelKey: "notificationsPage.title" },
        { id: "sync", route: "/more/sync", icon: "refresh", labelKey: "syncDiagnosticsPage.title" },
        { id: "settings", route: "/more/settings", icon: "edit", labelKey: "morePage.settings" },
        { id: "data", route: "/more/data", icon: "install", labelKey: "morePage.dataAndBackup" },
        { id: "about", route: "/more/about", icon: "mail", labelKey: "morePage.about" },
      ],
    },
    {
      id: "more",
      items: [{ id: "more", route: "/more", icon: "more", labelKey: "nav.more" }],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/**
 * Match por prefijo más largo: `/more/categories` tiene que encender la
 * entrada "Categorías", no la de "Más" (que también matchea `/more`).
 */
export function activeNavId(pathname: string, groups: NavGroup[]): string | null {
  let best: NavItem | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname !== item.route && !pathname.startsWith(`${item.route}/`)) continue;
      if (!best || item.route.length > best.route.length) best = item;
    }
  }
  return best?.id ?? null;
}
