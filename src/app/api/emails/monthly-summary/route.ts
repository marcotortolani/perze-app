import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { env } from "@/env";
import MonthlySummaryEmail from "@/emails/monthly-summary";
import { sendEmail } from "@/emails/send";
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
 * Deno; de ahí el reparto: allá se calcula, acá se renderiza y se manda.
 *
 * Este handler **no recibe ids ni consulta la base**: recibe los números ya
 * calculados. Si el secreto se filtrara, quien lo tenga puede mandarse
 * mails con números inventados, pero no puede leer datos de nadie.
 *
 * `proxy.ts` excluye `/api/*` de su matcher — este handler se autentica
 * solo, no hereda ningún gate.
 */

const localeSchema = z.enum(["es", "en", "pt"]);
/** Montos en unidades mínimas como string: un `bigint` no sobrevive a JSON. */
const minorUnits = z.string().regex(/^-?\d+$/, "monto en unidades mínimas");

const bodySchema = z.object({
  to: z.email(),
  locale: localeSchema,
  baseCurrency: z.string().min(1),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  income: minorUnits,
  expenses: minorUnits,
  net: minorUnits,
  /** Variación del gasto contra el período anterior. `null` = no hay con qué comparar. */
  expenseChangePct: z.number().nullable(),
  accounts: z.array(z.object({ name: z.string(), currencyCode: z.string().min(1), opening: minorUnits, closing: minorUnits })),
  topCategories: z.array(z.object({ label: z.string(), total: minorUnits })),
  investing: z.object({ invested: minorUnits, divested: minorUnits }).nullable(),
  excludedCount: z.number().int().min(0),
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
  const fmt = (amount: string, currency: string) => formatAmount(money(BigInt(amount), currency), { locale: numberLocale, showSign: false });

  const start = new Date(`${body.periodStart}T12:00:00.000Z`);
  const end = new Date(`${body.periodEnd}T12:00:00.000Z`);
  const periodLabel = `${formatDateLong(locale, start)} – ${formatDateLong(locale, end)}`;

  const changePct = body.expenseChangePct;
  const t = createTranslator({ locale, messages, namespace: "emails.monthlySummary" });

  const result = await sendEmail({
    to: body.to,
    subject: t("subject", { period: periodLabel }),
    react: MonthlySummaryEmail({
      locale,
      messages,
      siteUrl,
      periodLabel,
      income: fmt(body.income, body.baseCurrency),
      expenses: fmt(body.expenses, body.baseCurrency),
      net: fmt(body.net, body.baseCurrency),
      netDirection: directionOf(Number(body.net)),
      expenseChange:
        changePct === null
          ? null
          : {
              text: `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(Math.abs(changePct))}%`,
              direction: directionOf(changePct),
            },
      accounts: body.accounts.map((account) => ({
        name: account.name,
        opening: fmt(account.opening, account.currencyCode),
        closing: fmt(account.closing, account.currencyCode),
        direction: directionOf(Number(BigInt(account.closing) - BigInt(account.opening))),
      })),
      topCategories: body.topCategories.map((category) => ({ label: category.label, amount: fmt(category.total, body.baseCurrency) })),
      investing: body.investing
        ? { invested: fmt(body.investing.invested, body.baseCurrency), divested: fmt(body.investing.divested, body.baseCurrency) }
        : null,
      excludedCount: body.excludedCount,
      appUrl: `${siteUrl}/`,
    }),
  });

  if (!result.ok) {
    return jsonError(result.reason === "not_configured" ? "EMAIL_NOT_CONFIGURED" : "SEND_FAILED", result.reason === "not_configured" ? 503 : 502);
  }

  return NextResponse.json({}, { status: 200, headers: NO_STORE_HEADERS });
}
