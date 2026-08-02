import AccountDetailDefault from "../default";

/**
 * `/accounts/new` es una ruta estática hermana de `[id]`, no un detalle —
 * mismo problema y mismo arreglo que `@detail/resolve-fx/page.tsx`, ver esa
 * nota. Sin este archivo, el interceptor `@detail/(.)[id]` reclama "new"
 * como un id de cuenta en cualquier navegación blanda, y el modal de
 * `@modal/(.)accounts/new` queda con el detalle vacío dibujado por detrás.
 */
export default function AccountsNewDetailSlot() {
  return <AccountDetailDefault />;
}
