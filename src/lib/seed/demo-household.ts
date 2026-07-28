import { rateFromInteger } from "../fx/rate";
import { accountsRepo } from "../repos/accounts-repo";
import { categoriesRepo } from "../repos/categories-repo";
import { householdsRepo } from "../repos/households-repo";
import { nowIso } from "../repos/ids";
import { payeesRepo } from "../repos/payees-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { DEMO_USER_ID as USER_ID } from "../demo-user";
import { BASIC_CATEGORY_TEMPLATE as BASIC_TEMPLATE } from "../reference/category-templates";
import type { CategoryRow, PayeeRow } from "../db/schema";

const PAYEES: Array<{ name: string; category: string }> = [
  { name: "Disco", category: "Supermercado" },
  { name: "Tienda Inglesa", category: "Supermercado" },
  { name: "Pedidos Ya", category: "Restaurantes" },
  { name: "McDonald's", category: "Restaurantes" },
  { name: "ANCAP", category: "Transporte" },
  { name: "STM", category: "Transporte" },
  { name: "UTE", category: "Vivienda" },
  { name: "OSE", category: "Vivienda" },
  { name: "Farmashop", category: "Salud" },
  { name: "Netflix", category: "Entretenimiento" },
  { name: "Cinemark", category: "Entretenimiento" },
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("pick() sobre un array vacío");
  return item;
}

/**
 * Household de demo — cuentas, categorías y ~40 movimientos verosímiles.
 * Permite construir y mirar los Bloques B/D/E antes de que exista el
 * Bloque A (onboarding). Nunca se llama en producción con datos reales.
 */
export async function seedDemoHousehold(): Promise<{ householdId: string }> {
  const household = await householdsRepo.create({
    name: "Mi hogar",
    baseCurrency: "UYU",
    baseCountry: "UY",
    periodStartDay: 1,
    weekStart: 1,
    enabledModules: [],
    settings: {},
    createdBy: USER_ID,
  });

  await householdsRepo.setCurrentHouseholdId(household.id);
  await householdsRepo.addMember({
    householdId: household.id,
    profileId: USER_ID,
    role: "owner",
    displayName: "Vos",
    color: "var(--primary-fill)",
    joinedAt: nowIso(),
  });

  const categories = await categoriesRepo.bulkCreate(
    BASIC_TEMPLATE.map((c, i) => ({
      householdId: household.id,
      parentId: null,
      name: c.name,
      i18nKey: c.i18nKey,
      icon: c.icon,
      color: c.color,
      kind: c.kind,
      nature: "variable" as const,
      isSystem: true,
      sortOrder: i,
    }))
  );
  const categoryByName = new Map<string, CategoryRow>(categories.map((c) => [c.name, c]));

  const payeeByName = new Map<string, PayeeRow>();
  for (const p of PAYEES) {
    const row = await payeesRepo.create({
      householdId: household.id,
      name: p.name,
      defaultCategoryId: categoryByName.get(p.category)?.id ?? null,
      defaultAccountId: null,
      logoUrl: null,
      aliases: [],
    });
    payeeByName.set(p.name, row);
  }

  const cash = await accountsRepo.create({
    householdId: household.id,
    ownerId: USER_ID,
    name: "Efectivo",
    kind: "cash",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 80_000n,
    openingDate: daysAgoIso(60).slice(0, 10),
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER_ID,
  });

  const savings = await accountsRepo.create({
    householdId: household.id,
    ownerId: USER_ID,
    name: "Itaú Caja de Ahorro",
    kind: "savings",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 2_500_000n,
    openingDate: daysAgoIso(60).slice(0, 10),
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER_ID,
  });

  const checking = await accountsRepo.create({
    householdId: household.id,
    ownerId: USER_ID,
    name: "Brou Débito",
    kind: "checking",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 1_200_000n,
    openingDate: daysAgoIso(60).slice(0, 10),
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER_ID,
  });

  const wallet = await accountsRepo.create({
    householdId: household.id,
    ownerId: USER_ID,
    name: "Mercado Pago",
    kind: "wallet",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 350_000n,
    openingDate: daysAgoIso(60).slice(0, 10),
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER_ID,
  });

  const usdWallet = await accountsRepo.create({
    householdId: household.id,
    ownerId: USER_ID,
    name: "Ahorros USD",
    kind: "wallet",
    institutionId: null,
    countryCode: "US",
    currencyCode: "USD",
    openingBalance: 50_000n,
    openingDate: daysAgoIso(60).slice(0, 10),
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER_ID,
  });

  const expenseAccounts = [cash, checking, wallet];
  const expenseCategories = BASIC_TEMPLATE.filter((c) => c.kind === "expense").map(
    (c) => categoryByName.get(c.name)!
  );
  const salary = categoryByName.get("Sueldo")!;

  // ~40 gastos verosímiles en los últimos 60 días
  for (let i = 0; i < 34; i++) {
    const account = pick(expenseAccounts);
    const category = pick(expenseCategories);
    const payee = PAYEES.find((p) => p.category === category.name) ?? pick(PAYEES);
    const amountUyu = BigInt(200 + Math.floor(Math.random() * 180)) * 100n; // 200-380 pesos en centavos

    await transactionsRepo.create({
      householdId: household.id,
      createdBy: USER_ID,
      kind: "expense",
      occurredAt: daysAgoIso(Math.floor(Math.random() * 58)),
      accountId: account.id,
      counterAccountId: null,
      amount: amountUyu,
      currencyCode: "UYU",
      fxRate: rateFromInteger(1),
      fxSource: "identity",
      fxProvider: null,
      fxQuoteKind: null,
      fxResolvedAt: nowIso(),
      amountBase: amountUyu,
      counterAmount: null,
      counterCurrencyCode: null,
      counterFxRate: null,
      categoryId: category.id,
      payeeId: payeeByName.get(payee.name)?.id ?? null,
      note: null,
      attachments: [],
      location: null,
      status: "cleared",
      visibility: "household",
      recurringId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      source: "manual",
    });
  }

  // sueldo del mes
  await transactionsRepo.create({
    householdId: household.id,
    createdBy: USER_ID,
    kind: "income",
    occurredAt: daysAgoIso(5),
    accountId: checking.id,
    counterAccountId: null,
    amount: 4_500_000n,
    currencyCode: "UYU",
    fxRate: rateFromInteger(1),
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: nowIso(),
    amountBase: 4_500_000n,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: salary.id,
    payeeId: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
  });

  // un gasto en USD, con FX ya resuelto — ejercita la conversión multi-moneda
  await transactionsRepo.create({
    householdId: household.id,
    createdBy: USER_ID,
    kind: "expense",
    occurredAt: daysAgoIso(3),
    accountId: usdWallet.id,
    counterAccountId: null,
    amount: 4_500n, // USD 45.00
    currencyCode: "USD",
    fxRate: rateFromInteger(40),
    fxSource: "api",
    fxProvider: "dolarapi",
    fxQuoteKind: "oficial",
    fxResolvedAt: nowIso(),
    amountBase: 180_000n, // 45 * 40 = 1800.00 UYU
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: categoryByName.get("Entretenimiento")!.id,
    payeeId: null,
    note: "Suscripción anual",
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
  });

  // un gasto en ARS SIN tipo de cambio — demuestra needs_fx (E8, D1 badge)
  await transactionsRepo.create({
    householdId: household.id,
    createdBy: USER_ID,
    kind: "expense",
    occurredAt: daysAgoIso(1),
    accountId: cash.id,
    counterAccountId: null,
    amount: 350_000n, // ARS 3500,00
    currencyCode: "ARS",
    fxRate: null,
    fxSource: "pending",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: categoryByName.get("Restaurantes")!.id,
    payeeId: null,
    note: "Cena en Buenos Aires",
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
  });

  // una transferencia entre cuentas propias
  await transactionsRepo.create({
    householdId: household.id,
    createdBy: USER_ID,
    kind: "transfer",
    occurredAt: daysAgoIso(10),
    accountId: savings.id,
    counterAccountId: wallet.id,
    amount: 500_000n,
    currencyCode: "UYU",
    fxRate: rateFromInteger(1),
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: nowIso(),
    amountBase: 500_000n,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: null,
    payeeId: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
  });

  return { householdId: household.id };
}

/** Borra todo lo del household de demo (dev only) — útil para resetear /dev. */
export async function clearHousehold(householdId: string): Promise<void> {
  const { getDb } = await import("../db/client");
  const db = getDb();
  await db.transaction(
    "rw",
    [db.households, db.householdMembers, db.accounts, db.categories, db.payees, db.transactions],
    async () => {
      await db.transactions.where("householdId").equals(householdId).delete();
      await db.accounts.where("householdId").equals(householdId).delete();
      await db.categories.where("householdId").equals(householdId).delete();
      await db.payees.where("householdId").equals(householdId).delete();
      await db.householdMembers.where("householdId").equals(householdId).delete();
      await db.households.delete(householdId);
    }
  );
}
