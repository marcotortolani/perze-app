"use client";

import { AccountRow, Sheet } from "@/design-system";
import type { AccountRow as AccountRowData } from "@/lib/db/schema";
import { money } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON } from "@/lib/reference/account-kind-labels";

export interface AccountPickerSheetProps {
  open: boolean;
  title: string;
  accounts: AccountRowData[];
  onSelect: (account: AccountRowData) => void;
  onClose: () => void;
}

export function AccountPickerSheet({ open, title, accounts, onSelect, onClose }: AccountPickerSheetProps) {
  return (
    <Sheet open={open} title={title} onClose={onClose} height={420}>
      <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: 340 }}>
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            name={a.name}
            meta={a.currencyCode}
            balance={money(a.currentBalance, a.currencyCode)}
            icon={ACCOUNT_KIND_ICON[a.kind]}
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
