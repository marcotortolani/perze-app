import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { env } from "@/env";
import MonthlySummaryEmail from "@/emails/monthly-summary";
import { sendEmail } from "@/emails/send";
import { buildMonthlySummary } from "@/lib/analytics/monthly-summary";
import { formatAmount } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { formatDateLong, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import messagesEs from "../../../../../messages/es.json";
import messagesEn from "../../../../../messages/en.json";
import messagesPt from "../../../../../messages/pt.json";

/**
 * Manda el resumen del período que cerró (`docs/resumen-mensual-por-mail.md`).
 *
 * **La llama la Edge Function `monthly-summary`, no un usuario.** Esa
 * función es la que puede usar `service_role` para leer los movimientos de
 * todos los hogares — `CLAUDE.md` solo lo permite ahí y en cron. Pero los
 * mails de la app se arman con React Email y next-intl, que no corren en
 * Deno; de ahí el reparto: allá se lee, acá se calcula, se renderiza y se
 * manda.
 *
 * El cálculo vive de este lado a propósito (`buildMonthlySummary`): la
 * regla de signo por `kind` y la exclusión de `needs_fx` ya existen en
 * TypeScript y no se duplican en Deno — ver la nota de ese módulo.
 *
 * Este handler **no consulta la base ni recibe ids de hogar**: recibe las
 * filas que ese miembro puede ver, ya filtradas por visibilidad del otro
 * lado. Si el secreto se filtrara, quien lo tenga puede mandarse mails con
 * números inventados, pero no puede leer datos de nadie.
 *
 * `proxy.ts` excluye `/api/*` de su matcher — este handler se autentica
 * solo, no hereda ningún gate.
 */

const localeSchema = z.enum(["es", "en", "pt"]);
/** Montos en unidades mínimas como string: un `bigint` no sobrevive a JSON. */
const minorUnits = z.string().regex(/^-?\d+$/, "monto en unidades mínimas");

const kindSchema = z.enum(["expense", "income", "transfer", "adjustment", "investing"]);
/** Un `Date` inválido no rompe: recorta todo por rango y el resumen sale en cero. Se rechaza acá. */
const instant = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "fecha-hora inválida");

const transactionSchema = z.object({
  kind: kindSchema,
  /** `null` = sin cotización. Nunca 1 (`CLAUDE.md` § needs_fx). */
  amountBase: minorUnits.nullable(),
  occurredAt: instant,
  categoryId: z.uuid().nullable(),
  /** `null` si ese miembro no puede ver la categoría — cuenta en el total, no se nombra. */
  categoryName: z.string().nullable(),
});

const bodySchema = z.object({
  to: z.email(),
  locale: localeSchema,
  baseCurrency: z.string().min(1),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  /** Inicio del período anterior — su fin es `periodStart`. Sin esto no hay comparación. */
  previousPeriodStart: z.iso.date(),
  accounts: z.array(z.object({ name: z.string(), currencyCode: z.string().min(1), opening: minorUnits, closing: minorUnits })),
  transactions: z.array(transactionSchema),
  previousTransactions: z.array(z.object({ kind: kindSchema, amountBase: minorUnits.nullable(), occurredAt: instant })),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MESSAGES: Record<Locale, Record<string, any>> = { es: messagesEs, en: messagesEn, pt: messagesPt };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

/**
 * Comparación en tiempo constante. Un `===` sobre un secreto filtra su
 * longitud y su prefijo por diferencia de tiempo — es barato no hacerlo.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Debajo de este umbral la variación se cuenta como "prácticamente lo
 * mismo". Decir "gastaste un 0,3% más" es ruido con forma de dato.
 */
const FLAT_PCT_THRESHOLD = 1;

function directionOf(value: number): "up" | "down" | "flat" {
  if (Math.abs(value) < FLAT_PCT_THRESHOLD) return "flat";
  return value > 0 ? "up" : "down";
}

export async function POST(request: Request) {
  const secret = env.MONTHLY_SUMMARY_SECRET;
  // Sin secreto configurado la ruta no existe para nadie. Es lo correcto
  // en un self-host que no activó los resúmenes: mejor 404 que una ruta
  // abierta esperando que alguien adivine que no hay que autenticarse.
  if (!secret) return jsonError("NOT_CONFIGURED", 404);
  if (!secretMatches(request.headers.get("x-perze-summary-secret"), secret)) return jsonError("UNAUTHORIZED", 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return jsonError("PARAMS_INVALIDOS", 400);
  const body = parsed.data;

  const locale = body.locale;
  const messages = MESSAGES[locale];
  const numberLocale = numberLocaleForUiLocale(locale);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // El formateo vive de este lado: la precisión se deriva de cada moneda
  // (`decimalsFor`), así que un saldo en pesos y uno en bitcoin no se
  // muestran igual. La plantilla no decide nada de eso.
  const fmt = (amount: bigint, currency: string) => formatAmount(money(amount, currency), { locale: numberLocale, showSign: false });

  // Mediodía UTC para las fechas que solo se muestran: a medianoche UTC,
  // cualquier huso negativo las dibuja un día antes (`CLAUDE.md`).
  const periodLabel = `${formatDateLong(locale, new Date(`${body.periodStart}T12:00:00.000Z`))} – ${formatDateLong(
    locale,
    new Date(`${body.periodEnd}T12:00:00.000Z`)
  )}`;

  // Los límites del cálculo, en cambio, son instantes: `[from, to)` con
  // `periodEnd` inclusivo, así que el corte es el día siguiente a las 00:00
  // UTC. **El hogar no guarda huso horario** (decisión cerrada: la app lee
  // el del dispositivo), así que el único corte defendible del lado
  // servidor es UTC — y tiene que ser EL MISMO que usa la consulta de la
  // Edge Function, o el recorte de acá dejaría afuera filas que sí vinieron.
  const from = new Date(`${body.periodStart}T00:00:00.000Z`);
  const to = new Date(`${body.periodEnd}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  const previousFrom = new Date(`${body.previousPeriodStart}T00:00:00.000Z`);

  const summary = buildMonthlySummary({
    from,
    to,
    previousFrom,
    transactions: body.transactions.map((tx) => ({ ...tx, amountBase: tx.amountBase === null ? null : BigInt(tx.amountBase) })),
    previousTransactions: body.previousTransactions.map((tx) => ({ ...tx, amountBase: tx.amountBase === null ? null : BigInt(tx.amountBase) })),
    accounts: body.accounts.map((account) => ({ ...account, opening: BigInt(account.opening), closing: BigInt(account.closing) })),
  });

  // Un hogar que no movió nada en el mes no recibe un mail de resumen
  // vacío. No es un error: la Edge Function lo cuenta y sigue.
  if (!summary.hasActivity) return NextResponse.json({ sent: false, reason: "NO_ACTIVITY" }, { status: 200, headers: NO_STORE_HEADERS });

  const changePct = summary.expenseChangePct;
  const t = createTranslator({ locale, messages, namespace: "emails.monthlySummary" });

  const result = await sendEmail({
    to: body.to,
    subject: t("subject", { period: periodLabel }),
    react: MonthlySummaryEmail({
      locale,
      messages,
      siteUrl,
      periodLabel,
      income: fmt(summary.income, body.baseCurrency),
      expenses: fmt(summary.expenses, body.baseCurrency),
      net: fmt(summary.net, body.baseCurrency),
      netDirection: directionOf(Number(summary.net)),
      expenseChange:
        changePct === null
          ? null
          : {
              text: `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(Math.abs(changePct))}%`,
              direction: directionOf(changePct),
            },
      accounts: summary.accounts.map((account) => ({
        name: account.name,
        // Cada saldo en la moneda de SU cuenta: consolidar dólares con
        // pesos daría un número sin significado y el resumen no lo inventa.
        opening: fmt(account.opening, account.currencyCode),
        closing: fmt(account.closing, account.currencyCode),
        direction: directionOf(Number(account.closing - account.opening)),
      })),
      topCategories: summary.topCategories.map((category) => ({ label: category.label, amount: fmt(category.total, body.baseCurrency) })),
      investing: summary.investing
        ? { invested: fmt(summary.investing.invested, body.baseCurrency), divested: fmt(summary.investing.divested, body.baseCurrency) }
        : null,
      excludedCount: summary.excludedCount,
      appUrl: `${siteUrl}/`,
    }),
  });

  if (!result.ok) {
    return jsonError(result.reason === "not_configured" ? "EMAIL_NOT_CONFIGURED" : "SEND_FAILED", result.reason === "not_configured" ? 503 : 502);
  }

  return NextResponse.json({ sent: true }, { status: 200, headers: NO_STORE_HEADERS });
}
