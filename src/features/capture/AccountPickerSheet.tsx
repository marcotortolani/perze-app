"use client";

import { AccountRow, Sheet } from "@/design-system";
import type { AccountRow as AccountRowData } from "@/lib/db/schema";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON } from "@/lib/reference/account-kind-labels";
import { accountColorVar } from "@/lib/reference/account-colors";
import { usePinUnlocked } from "@/components/pin-gate";

export interface AccountPickerSheetProps {
  open: boolean;
  title: string;
  accounts: AccountRowData[];
  onSelect: (account: AccountRowData) => void;
  onClose: () => void;
}

/**
 * C22 — este picker se abre desde `/add` (captura pre-auth por diseño, ver
 * `PinGate`), así que el bloqueo por PIN no lo cubre. Sin esto, un
 * long-press en el ícono del shortcut evadía el bloqueo mostrando nombre y
 * saldo de cada cuenta. `privacy` blurea el monto (no oculta el resto del
 * picker: elegir cuenta para guardar sigue siendo pre-auth, "escribir no
 * revela nada" — el saldo sí revela).
 */
export function AccountPickerSheet({ open, title, accounts, onSelect, onClose }: AccountPickerSheetProps) {
  const pinUnlocked = usePinUnlocked();

  return (
    // 8 filas de 56px sin scroll (`ListRow` es de altura fija) — antes
    // `420` apenas entraban 5. `Overlay` sigue capando a `80dvh`, así que
    // en un teléfono muy bajo (iPhone SE) igual aparece scroll; es el
    // límite físico de pantalla, no algo que se pueda subir más sin tapar
    // toda la pantalla.
    <Sheet open={open} title={title} onClose={onClose} height={560}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            name={a.name}
            meta={a.currencyCode}
            balance={money(a.currentBalance, a.currencyCode)}
            icon={ACCOUNT_KIND_ICON[a.kind]}
            iconBackground={accountColorVar(a.color)}
            privacy={!pinUnlocked}
            onClick={() => {
              onSelect(a);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}
