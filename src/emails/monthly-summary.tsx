import { Column, Heading, Hr, Row, Text } from "@react-email/components";
import { createTranslator } from "next-intl";
import { EmailButton } from "./components/EmailButton";
import { EmailLayout } from "./components/EmailLayout";
import { emailTheme } from "./theme";

export type MonthlySummaryEmailLocale = "es" | "en" | "pt";

/** Una fila "concepto / monto". El monto viene YA formateado — ver la nota de props. */
export interface SummaryLine {
  label: string;
  amount: string;
}

export interface AccountLine {
  name: string;
  opening: string;
  closing: string;
  /** Para el signo del cambio, sin depender de parsear el string formateado. */
  direction: "up" | "down" | "flat";
}

export type MonthlySummaryEmailProps = {
  locale: MonthlySummaryEmailLocale;
  /**
   * El anual es el mismo cuerpo sobre doce períodos, con otro título y una
   * sección más. Comparte namespace de textos a propósito: duplicar veinte
   * claves por idioma para cambiar tres es la forma de que los dos mails
   * se vayan pareciendo cada vez menos sin que nadie lo decida.
   */
  variant?: "monthly" | "annual";
  // Mismo motivo que `invite.tsx`: `use-intl` necesita `Record<string, any>`
  // para inferir las claves anidadas; con `unknown` colapsa a `never`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Record<string, any>;
  siteUrl: string;
  /** Rango real del período del hogar, ya formateado con el locale. */
  periodLabel: string;
  income: string;
  expenses: string;
  /** Resultado del período. */
  net: string;
  netDirection: "up" | "down" | "flat";
  /** Variación del gasto contra el período anterior. `null` = no hay con qué comparar. */
  expenseChange: { text: string; direction: "up" | "down" | "flat" } | null;
  accounts: AccountLine[];
  topCategories: SummaryLine[];
  /** Solo si hubo movimientos de inversión — si es `null`, la sección no se dibuja. */
  investing: { invested: string; divested: string } | null;
  /** Solo en el anual: el período de mayor gasto. `null` si no hubo gastos. */
  biggestMonth?: { label: string; amount: string } | null;
  /** Movimientos excluidos por falta de cotización. `0` = no se menciona. */
  excludedCount: number;
  appUrl: string;
};

/**
 * Resumen del período que acaba de cerrar (`docs/resumen-mensual-por-mail.md`).
 *
 * **Todos los montos llegan formateados.** Un `bigint` no sobrevive a JSON,
 * y esta plantilla la invoca una ruta de Next a la que la Edge Function le
 * postea números — así que el formateo (símbolo, decimales derivados de la
 * moneda) ocurre del lado de Next, con `lib/money`, antes de llegar acá.
 * Esta plantilla no hace cuentas ni decide precisión: solo dibuja.
 *
 * Orden deliberado: primero el balance del período con su comparación —la
 * pregunta que trae a alguien a abrir el mail—, después el estado de las
 * cuentas, después en qué se fue la plata, y las inversiones al final
 * porque son opcionales.
 *
 * Sin gráficos: los clientes de correo los rompen y obligarían a generar
 * imágenes del lado servidor.
 */
export default function MonthlySummaryEmail({
  locale,
  variant = "monthly",
  messages,
  siteUrl,
  periodLabel,
  income,
  expenses,
  net,
  netDirection,
  expenseChange,
  accounts,
  topCategories,
  investing,
  biggestMonth,
  excludedCount,
  appUrl,
}: MonthlySummaryEmailProps) {
  const t = createTranslator({ locale, messages, namespace: "emails.monthlySummary" });
  const annual = variant === "annual";
  const key = (base: string) => (annual ? `annual${base[0]!.toUpperCase()}${base.slice(1)}` : base);

  return (
    <EmailLayout siteUrl={siteUrl} preview={t(key("preview"), { period: periodLabel })}>
      <Heading as="h2" style={{ margin: "0 0 4px", fontSize: 22, lineHeight: "28px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textPrimary }}>
        {t(key("title"))}
      </Heading>
      <Text style={{ margin: "0 0 24px", fontSize: 14, lineHeight: "20px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {periodLabel}
      </Text>

      <SummaryRow label={t("income")} value={income} />
      <SummaryRow label={t("expenses")} value={expenses} />
      <SummaryRow label={t("net")} value={net} emphasis direction={netDirection} />

      {expenseChange ? (
        <Text style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textSecondary }}>
          {t(key(expenseChange.direction === "up" ? "spentMore" : expenseChange.direction === "down" ? "spentLess" : "spentSame"), { change: expenseChange.text })}
        </Text>
      ) : (
        <Text style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
          {t(key("noComparison"))}
        </Text>
      )}

      {/* El aviso de excluidos va PEGADO a los totales, no al final: es lo
          que los califica. Un total que parece completo y no lo es es peor
          que no mandarlo (`CLAUDE.md` § needs_fx). */}
      {excludedCount > 0 ? (
        <Text style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
          {t("excluded", { count: excludedCount })}
        </Text>
      ) : null}

      <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />

      <SectionTitle>{t("accountsTitle")}</SectionTitle>
      {accounts.map((account) => (
        <Row key={account.name} style={{ marginBottom: 8 }}>
          <Column>
            <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textPrimary }}>{account.name}</Text>
            <Text style={{ margin: 0, fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
              {t("accountRange", { opening: account.opening, closing: account.closing })}
            </Text>
          </Column>
        </Row>
      ))}

      {topCategories.length > 0 ? (
        <>
          <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />
          <SectionTitle>{t("categoriesTitle")}</SectionTitle>
          {topCategories.map((category) => (
            <SummaryRow key={category.label} label={category.label} value={category.amount} />
          ))}
        </>
      ) : null}

      {annual && biggestMonth ? (
        <>
          <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />
          <SectionTitle>{t("biggestMonthTitle")}</SectionTitle>
          <SummaryRow label={biggestMonth.label} value={biggestMonth.amount} />
        </>
      ) : null}

      {investing ? (
        <>
          <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />
          <SectionTitle>{t("investingTitle")}</SectionTitle>
          <SummaryRow label={t("invested")} value={investing.invested} />
          <SummaryRow label={t("divested")} value={investing.divested} />
        </>
      ) : null}

      <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />

      <EmailButton href={appUrl}>{t("cta")}</EmailButton>

      <Text style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {t("unsubscribeHint")}
      </Text>
    </EmailLayout>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ margin: "0 0 12px", fontSize: 13, lineHeight: "18px", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
      {children}
    </Text>
  );
}

function SummaryRow({ label, value, emphasis, direction }: { label: string; value: string; emphasis?: boolean; direction?: "up" | "down" | "flat" }) {
  // Polaridad: el verde se reserva para lo positivo y lo negativo queda en
  // texto neutro, nunca en rojo (`CLAUDE.md` — el verde/rojo del home es
  // una excepción cerrada a esa pantalla). El signo del número hace el
  // trabajo, el color solo acompaña.
  const color = emphasis && direction === "up" ? emailTheme.color.aqua : emailTheme.color.textPrimary;
  return (
    <Row style={{ marginBottom: 6 }}>
      <Column>
        <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textSecondary }}>{label}</Text>
      </Column>
      <Column align="right">
        <Text style={{ margin: 0, fontSize: emphasis ? 18 : 15, lineHeight: "24px", fontWeight: emphasis ? 600 : 400, fontFamily: emailTheme.fontStackMono, color }}>{value}</Text>
      </Column>
    </Row>
  );
}
