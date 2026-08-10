import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "un-secreto-largo-de-prueba";

const envMock = { MONTHLY_SUMMARY_SECRET: SECRET as string | undefined, NEXT_PUBLIC_SITE_URL: "https://perze.tortolani.cc" };
vi.mock("@/env", () => ({ env: envMock }));

const sendEmail = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/emails/send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...(args as [])) }));

const { POST } = await import("./route");

const CATEGORY_ID = "0198c0f0-0000-7000-8000-000000000001";

const validBody = {
  to: "ana@example.com",
  locale: "es",
  baseCurrency: "UYU",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  previousPeriodStart: "2026-06-01",
  accounts: [{ name: "Itaú", currencyCode: "USD", opening: "100000", closing: "80000" }],
  transactions: [
    { kind: "income", amountBase: "500000", occurredAt: "2026-07-03T14:00:00.000Z", categoryId: null, categoryName: null },
    { kind: "expense", amountBase: "320000", occurredAt: "2026-07-10T14:00:00.000Z", categoryId: CATEGORY_ID, categoryName: "Supermercado" },
  ],
  previousTransactions: [{ kind: "expense", amountBase: "285000", occurredAt: "2026-06-10T14:00:00.000Z" }],
};

function post(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-perze-summary-secret"] = secret;
  return POST(new Request("https://perze.tortolani.cc/api/emails/monthly-summary", { method: "POST", headers, body: JSON.stringify(body) }));
}

beforeEach(() => {
  envMock.MONTHLY_SUMMARY_SECRET = SECRET;
  sendEmail.mockClear();
  sendEmail.mockResolvedValue({ ok: true as const });
});

describe("POST /api/emails/monthly-summary — el secreto es el único límite", () => {
  it("sin header no manda nada", async () => {
    const res = await post(validBody, null);
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("con un secreto equivocado tampoco", async () => {
    const res = await post(validBody, "otro-secreto-de-igual-largo!!");
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sin secreto configurado la ruta no existe para nadie", async () => {
    // Un self-host que no activó los resúmenes no debe tener una ruta
    // abierta esperando que alguien descubra que no hay que autenticarse.
    envMock.MONTHLY_SUMMARY_SECRET = undefined;
    const res = await post(validBody);
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/emails/monthly-summary — validación y formato", () => {
  it("rechaza un cuerpo inválido antes de mandar nada", async () => {
    const res = await post({ ...validBody, transactions: [{ ...validBody.transactions[0], amountBase: "no-es-un-numero" }] });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rechaza una fecha que no se puede parsear en vez de resumir en cero", async () => {
    // Un `Date` inválido no tira: hace que todo quede fuera de rango y el
    // mail saldría con todos los totales en cero, sin que nada falle.
    const res = await post({ ...validBody, transactions: [{ ...validBody.transactions[0], occurredAt: "el martes" }] });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("un período sin movimientos no genera mail", async () => {
    const res = await post({ ...validBody, transactions: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: false, reason: "NO_ACTIVITY" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("formatea cada monto en la moneda que corresponde, no todo en la base", async () => {
    await post(validBody);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0]![0] as { to: string; subject: string; react: ReactElement };
    expect(call.to).toBe("ana@example.com");

    const html = await render(call.react);
    // Totales del período en moneda base (UYU)…
    expect(html).toContain("5.000");
    // …y el saldo de la cuenta en la SUYA (USD), que es otra moneda. Si
    // todo se formateara con la moneda base, un saldo en dólares saldría
    // con el símbolo del peso.
    expect(html).toContain("US$");
  });

  it("sin período anterior no inventa un 0%", async () => {
    await post({ ...validBody, previousTransactions: [] });
    const html = await render((sendEmail.mock.calls[0]![0] as { react: ReactElement }).react);
    expect(html).toContain("no hay con qué comparar");
  });

  it("solo cuenta la categoría que ese miembro puede ver", async () => {
    // La categoría privada de otro miembro no se nombra por mail, pero su
    // plata sigue adentro del total de egresos.
    await post({
      ...validBody,
      transactions: [
        ...validBody.transactions,
        { kind: "expense", amountBase: "40000", occurredAt: "2026-07-12T14:00:00.000Z", categoryId: CATEGORY_ID.replace("1", "2"), categoryName: null },
      ],
    });
    const html = await render((sendEmail.mock.calls[0]![0] as { react: ReactElement }).react);
    expect(html).toContain("Supermercado");
    // 320.000 + 40.000 en unidades mínimas = $ 3.600
    expect(html).toContain("3.600");
  });

  it("una variación mínima cuenta como 'prácticamente lo mismo'", async () => {
    // "Gastaste un 0,3% más" es ruido con forma de dato.
    await post({ ...validBody, previousTransactions: [{ kind: "expense", amountBase: "319000", occurredAt: "2026-06-10T14:00:00.000Z" }] });
    const html = await render((sendEmail.mock.calls[0]![0] as { react: ReactElement }).react);
    expect(html).toContain("prácticamente lo mismo");
  });

  it("propaga el fallo de envío en vez de responder 200", async () => {
    sendEmail.mockResolvedValue({ ok: false, reason: "send_failed" } as never);
    const res = await post(validBody);
    expect(res.status).toBe(502);
  });
});
