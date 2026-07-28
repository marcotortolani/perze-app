import * as z from "zod";
import { visibilitySchema } from "./transaction";

/** Los nueve tipos de cuenta, lista canónica — `docs/00-producto.md` § 3.1. */
export const accountKindSchema = z.enum([
  "cash",
  "checking",
  "savings",
  "credit_card",
  "wallet",
  "broker",
  "loan",
  "receivable",
  "other",
]);

export const newAccountSchema = z
  .object({
    householdId: z.uuid(),
    ownerId: z.uuid(),
    name: z.string().min(1).max(80),
    kind: accountKindSchema,
    institutionId: z.uuid().nullable(),
    countryCode: z.string().length(2).nullable(),
    currencyCode: z.string().min(1).max(10),
    openingBalance: z.bigint(),
    openingDate: z.iso.date().nullable(),
    creditLimit: z.bigint().nullable(),
    statementDay: z.number().int().min(1).max(31).nullable(),
    dueDay: z.number().int().min(1).max(31).nullable(),
    interestRate: z.string().nullable(),
    termMonths: z.number().int().positive().nullable(),
    includeInNetWorth: z.boolean(),
    visibility: visibilitySchema,
    color: z.string().nullable(),
    icon: z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdBy: z.uuid(),
  })
  .superRefine((account, ctx) => {
    if (account.kind === "credit_card" && (account.statementDay === null || account.dueDay === null)) {
      ctx.addIssue({
        code: "custom",
        message: "Una tarjeta de crédito necesita día de cierre y de vencimiento.",
        path: ["statementDay"],
      });
    }
    if (account.kind === "loan" && (account.interestRate === null || account.termMonths === null)) {
      ctx.addIssue({
        code: "custom",
        message: "Un préstamo necesita tasa y plazo.",
        path: ["interestRate"],
      });
    }
  });

export type NewAccountParsed = z.infer<typeof newAccountSchema>;
