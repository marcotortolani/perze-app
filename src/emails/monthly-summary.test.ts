import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import MonthlySummaryEmail, { type MonthlySummaryEmailLocale, type MonthlySummaryEmailProps } from "./monthly-summary";
import messagesEs from "../../messages/es.json";
import messagesEn from "../../messages/en.json";
import messagesPt from "../../messages/pt.json";

const MESSAGES: Record<MonthlySummaryEmailLocale, Record<string, unknown>> = { es: messagesEs, en: messagesEn, pt: messagesPt };

type BaseProps = Omit<MonthlySummaryEmailProps, "locale" | "messages">;

const baseProps: BaseProps = {
  siteUrl: "https://perze.tortolani.cc",
  periodLabel: "1 – 31 de julio de 2026",
  income: "US$ 5.000,00",
  expenses: "US$ 3.200,00",
  net: "US$ 1.800,00",
  netDirection: "up",
  expenseChange: { text: "12%", direction: "up" },
  accounts: [{ name: "Itaú", opening: "US$ 1.000,00", closing: "US$ 800,00", direction: "down" }],
  topCategories: [{ label: "Supermercado", amount: "US$ 900,00" }],
  investing: null,
  excludedCount: 0,
  appUrl: "https://perze.tortolani.cc/",
};

const renderEmail = (locale: MonthlySummaryEmailLocale, props: Partial<BaseProps> = {}) =>
  render(
    MonthlySummaryEmail({
      locale,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: MESSAGES[locale] as any,
      ...baseProps,
      ...props,
    })
  );

describe.each(["es", "en", "pt"] as const)("MonthlySummaryEmail — locale %s", (locale) => {
  it("muestra el período, los totales y el estado de las cuentas", async () => {
    const html = await renderEmail(locale);
    expect(html).toContain("1 – 31 de julio de 2026");
    expect(html).toContain("US$ 5.000,00");
    expect(html).toContain("US$ 3.200,00");
    expect(html).toContain("Itaú");
    expect(html).toContain("US$ 1.000,00");
    expect(html).toContain("US$ 800,00");
  });

  it("no usa CSS vars ni color-mix — un cliente de mail no ejecuta globals.css", async () => {
    const html = await renderEmail(locale);
    expect(html).not.toContain("var(--");
    expect(html).not.toContain("color-mix(");
  });
});

describe("MonthlySummaryEmail — secciones condicionales", () => {
  it("sin inversiones no dibuja la sección: quien no invierte no recibe un bloque vacío", async () => {
    const html = await renderEmail("es", { investing: null });
    expect(html).not.toContain("Inversiones");
  });

  it("con inversiones sí la dibuja", async () => {
    const html = await renderEmail("es", { investing: { invested: "US$ 500,00", divested: "US$ 100,00" } });
    expect(html).toContain("Inversiones");
    expect(html).toContain("US$ 500,00");
  });

  it("declara los movimientos sin cotización junto a los totales", async () => {
    // Un total que parece completo y no lo es es peor que no mandar el mail.
    const html = await renderEmail("es", { excludedCount: 3 });
    expect(html).toMatch(/3 movimientos sin cotización/);
  });

  it("sin excluidos no menciona nada", async () => {
    const html = await renderEmail("es", { excludedCount: 0 });
    expect(html).not.toContain("sin cotización");
  });

  it("sin período anterior dice que no hay con qué comparar, en vez de mostrar 0%", async () => {
    const html = await renderEmail("es", { expenseChange: null });
    expect(html).toContain("no hay con qué comparar");
    // Nada de "Gastaste X más/menos": no hay contra qué, y un 0% seria
    // afirmar que no cambio, que es otra cosa. (No se puede asertar sobre
    // "0%" a secas: el hack de Outlook mete `mso-font-width:0%` en el CSS.)
    expect(html).not.toContain("Gastaste");
  });

  it("sin categorías no dibuja esa sección", async () => {
    const html = await renderEmail("es", { topCategories: [] });
    expect(html).not.toContain("En qué se fue");
  });
});
