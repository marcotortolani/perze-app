"use client";

import { AccountsListContent } from "./AccountsListContent";

/** E1 — lista de cuentas. Wrapper delgado: el contenido vive en `AccountsListContent`, reusado también por `layout.tsx` en el hard-reload de `/accounts/[id]` (ver la nota ahí). */
export default function AccountsPage() {
  return <AccountsListContent />;
}
