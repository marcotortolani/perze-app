import * as z from "zod";

export const categoryKindSchema = z.enum(["expense", "income"]);
export const categoryNatureSchema = z.enum(["fixed", "variable", "discretionary"]);

export const newCategorySchema = z.object({
  householdId: z.uuid(),
  parentId: z.uuid().nullable(),
  name: z.string().min(1).max(60),
  icon: z.string().min(1),
  color: z.string().min(1),
  kind: categoryKindSchema,
  nature: categoryNatureSchema,
  isSystem: z.boolean(),
  sortOrder: z.number().int(),
});

export type NewCategoryParsed = z.infer<typeof newCategorySchema>;

export const newTagSchema = z.object({
  householdId: z.uuid(),
  name: z.string().min(1).max(40),
  color: z.string().nullable(),
});

export const newPayeeSchema = z.object({
  householdId: z.uuid(),
  name: z.string().min(1).max(80),
  defaultCategoryId: z.uuid().nullable(),
  defaultAccountId: z.uuid().nullable(),
  logoUrl: z.string().nullable(),
  aliases: z.array(z.string()),
});
