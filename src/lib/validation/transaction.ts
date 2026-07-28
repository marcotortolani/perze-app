import * as z from "zod";

export const transactionKindSchema = z.enum(["expense", "income", "transfer", "adjustment"]);
export const visibilitySchema = z.enum(["private", "household"]);
export const fxSourceSchema = z.enum(["identity", "api", "manual", "inherited", "pending"]);
export const transactionStatusSchema = z.enum(["cleared", "pending", "scheduled", "void"]);

export const attachmentSchema = z.object({
  path: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  thumb: z.string().nullable(),
});

/**
 * Valida el borrador de captura antes de llegar al repo. Los montos ya
 * llegan como `bigint` (post `lib/money`) — este schema nunca parsea un
 * string de plata; eso es trabajo de `parseAmountString`/`evaluateKeypadExpression`.
 */
export const newTransactionSchema = z
  .object({
    householdId: z.uuid(),
    createdBy: z.uuid(),
    kind: transactionKindSchema,
    occurredAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
    accountId: z.uuid(),
    counterAccountId: z.uuid().nullable(),
    amount: z.bigint(),
    currencyCode: z.string().min(1).max(10),
    fxRate: z.bigint().nullable(),
    fxSource: fxSourceSchema,
    fxProvider: z.string().nullable(),
    fxQuoteKind: z.string().nullable(),
    fxResolvedAt: z.string().nullable(),
    amountBase: z.bigint().nullable(),
    counterAmount: z.bigint().nullable(),
    counterCurrencyCode: z.string().nullable(),
    counterFxRate: z.bigint().nullable(),
    categoryId: z.uuid().nullable(),
    payeeId: z.uuid().nullable(),
    note: z.string().max(500).nullable(),
    attachments: z.array(attachmentSchema),
    location: z.object({ lat: z.number(), lng: z.number(), label: z.string() }).nullable(),
    status: transactionStatusSchema,
    visibility: visibilitySchema,
    recurringId: z.uuid().nullable(),
    installmentGroupId: z.uuid().nullable(),
    installmentNumber: z.number().int().positive().nullable(),
    installmentTotal: z.number().int().positive().nullable(),
    source: z.enum(["manual", "voice", "import", "recurring", "rule"]),
  })
  .superRefine((tx, ctx) => {
    // CHECK (kind = 'adjustment' OR amount > 0) — doc 01 § 2.5
    if (tx.kind !== "adjustment" && tx.amount <= 0n) {
      ctx.addIssue({
        code: "custom",
        message: "El monto tiene que ser positivo salvo para ajustes.",
        path: ["amount"],
      });
    }
    // invariante fx: o están los dos, o ninguno
    if ((tx.fxRate === null) !== (tx.amountBase === null)) {
      ctx.addIssue({
        code: "custom",
        message: "fxRate y amountBase tienen que estar los dos o ninguno.",
        path: ["fxRate"],
      });
    }
    if (tx.kind === "transfer" && !tx.counterAccountId) {
      ctx.addIssue({
        code: "custom",
        message: "Una transferencia necesita cuenta de destino.",
        path: ["counterAccountId"],
      });
    }
  });

export type NewTransactionParsed = z.infer<typeof newTransactionSchema>;
