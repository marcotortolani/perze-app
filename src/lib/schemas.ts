import { z } from "zod"

export const TransactionTypeEnum = z.enum(["income", "expense", "investment"])
export const TransactionSourceEnum = z.enum(["manual", "ai-receipt"])

export const TransactionSchema = z.object({
  type: TransactionTypeEnum,
  amount: z
    .number()
    .finite("El monto debe ser un número válido")
    .positive("El monto debe ser mayor a 0"),
  currencyCode: z.string().min(1, "Seleccioná una moneda"),
  countryCode: z.string().min(1, "Seleccioná un país"),
  categoryId: z.string().min(1, "Seleccioná una categoría"),
  date: z.string().min(1, "La fecha es obligatoria"),
  description: z.string().min(1, "Agregá una descripción").max(200),
  notes: z.string().max(500).optional(),
  source: TransactionSourceEnum.optional().default("manual"),
  receiptId: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export type TransactionInput = z.infer<typeof TransactionSchema>
