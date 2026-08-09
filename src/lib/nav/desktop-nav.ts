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
export function buildDesktopNav(input: { enabledModules: string[]; isMultiCurrency?: boolean }): NavGroup[] {
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
        ...(input.isMultiCurrency ? [{ id: "currencies", route: "/currencies", icon: "refresh" as IconName, labelKey: "settingsPage.fxSources" }] : []),
        ...(modules.includes("budgets") ? [{ id: "budgets", route: "/budgets", icon: "target" as IconName, labelKey: "morePage.budgets" }] : []),
        ...(modules.includes("goals") ? [{ id: "goals", route: "/goals", icon: "flag" as IconName, labelKey: "morePage.goals" }] : []),
        ...(modules.includes("recurring") ? [{ id: "recurring", route: "/recurring", icon: "refresh" as IconName, labelKey: "morePage.recurring" }] : []),
        ...(modules.includes("debts") ? [{ id: "debts", route: "/debts", icon: "handshake" as IconName, labelKey: "morePage.debts" }] : []),
        ...(modules.includes("investments") ? [{ id: "investments", route: "/investments", icon: "invest" as IconName, labelKey: "nav.investments" }] : []),
        { id: "categories", route: "/more/categories", icon: "square-half", labelKey: "morePage.categories" },
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
    // Sistema entra como UNA entrada, no como un bloque de siete. Los siete
    // destinos (perfil, seguridad, notificaciones, sincronización, ajustes,
    // datos, acerca de) son configuración que se visita de vez en cuando, y
    // desplegados ocupaban un tercio del alto del sidebar: con varios módulos
    // encendidos el panel no entraba en pantalla y scrolleaba. Ahora se llega
    // a todos por `/more`, que en escritorio muestra exactamente ese bloque
    // (ver `(app)/more/page.tsx`).
    //
    // Sin `captionKey` a propósito: un encabezado "SISTEMA" sobre una sola
    // fila es ruido, y la fila ya se llama igual.
    //
    // Esta entrada reemplaza además a la de "Más", que apuntaba al mismo
    // `/more`: en escritorio esa página era una copia de lo que el sidebar ya
    // muestra al costado. En móvil "Más" sigue existiendo como 5º tab de la
    // `TabBar`, que se arma aparte de esto.
    {
      id: "system",
      items: [{ id: "system", route: "/more", icon: "gear", labelKey: "morePage.system" }],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/**
 * Match por prefijo más largo: `/more/categories` tiene que encender la
 * entrada "Categorías", no la de "Sistema" (que matchea `/more` y por lo
 * tanto también `/more/categories`). Las subrutas de sistema que NO tienen
 * entrada propia (`/more/profile`, `/more/settings`, …) caen bien: su único
 * match es `/more`, o sea "Sistema".
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
