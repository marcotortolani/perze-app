import type { CSSProperties } from "react";
import { ListRow } from "../core/ListRow";
import type { IconName } from "../core/Icon";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";

export interface AccountRowProps {
  name: string;
  meta?: string | undefined;
  balance: Money;
  icon?: IconName | undefined;
  privacy?: boolean | undefined;
  onClick?: () => void | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Consolida `ListRow variant="value"` + `Amount` — se repetía a mano en
 * cinco superficies del Bloque E (lista de cuentas, detalle, conciliación,
 * resolución en lote, tarjeta de crédito).
 */
export function AccountRow({ name, meta, balance, icon = "wallet", privacy = false, onClick, style }: AccountRowProps) {
  return (
    <ListRow
      label={name}
      meta={meta}
      icon={icon}
      variant="value"
      chevron={false}
      onClick={onClick}
      style={style}
      value={<Amount value={balance} size="body" showSign={false} polarity="neutral" privacy={privacy} tabular />}
    />
  );
}
