import AccountDetailDefault from "../default";

/**
 * `/accounts/resolve-fx` es una ruta estática hermana de `[id]`, no un
 * detalle — mismo problema y mismo arreglo que
 * `transactions/@detail/calendar/page.tsx`, ver esa nota. Sin este
 * archivo, el interceptor `@detail/(.)[id]` reclama "resolve-fx" como un
 * id de cuenta en cualquier navegación blanda.
 */
export default function AccountsResolveFxDetailSlot() {
  return <AccountDetailDefault />;
}
