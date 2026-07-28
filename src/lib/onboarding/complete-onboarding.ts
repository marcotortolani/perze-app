import { accountsRepo } from "../repos/accounts-repo";
import { categoriesRepo } from "../repos/categories-repo";
import { householdsRepo } from "../repos/households-repo";
import { nowIso } from "../repos/ids";
import { DEMO_USER_ID } from "../demo-user";
import { BASIC_CATEGORY_TEMPLATE } from "../reference/category-templates";
import type { AccountKind, EnabledModule } from "../db/schema";
import type { HouseholdUsage } from "@/stores/onboarding-store";

export interface CompleteOnboardingParams {
  countryCode: string;
  currencyCode: string;
  usage: HouseholdUsage;
  accountName: string;
  accountKind: AccountKind;
}

/**
 * Cierre de A11: household + primera cuenta (saldo 0 — A7 se pide después
 * del primer gasto) + plantilla Básica de categorías, todo en una sola
 * llamada. La plantilla se aplica en silencio (A8 no es camino crítico);
 * los módulos opcionales quedan todos apagados salvo el que decidió A5.
 */
export async function completeOnboarding({ countryCode, currencyCode, usage, accountName, accountKind }: CompleteOnboardingParams): Promise<{ householdId: string; accountId: string }> {
  const enabledModules: EnabledModule[] = usage === "familia" ? ["family"] : [];

  const household = await householdsRepo.create({
    name: "Mi hogar",
    baseCurrency: currencyCode,
    baseCountry: countryCode,
    periodStartDay: 1,
    weekStart: 1,
    enabledModules,
    settings: {},
    createdBy: DEMO_USER_ID,
  });

  await householdsRepo.setCurrentHouseholdId(household.id);
  await householdsRepo.addMember({
    householdId: household.id,
    profileId: DEMO_USER_ID,
    role: "owner",
    displayName: "Vos",
    color: "var(--primary-fill)",
    joinedAt: nowIso(),
  });

  await categoriesRepo.bulkCreate(
    BASIC_CATEGORY_TEMPLATE.map((c, i) => ({
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

  const account = await accountsRepo.create({
    householdId: household.id,
    ownerId: DEMO_USER_ID,
    name: accountName,
    kind: accountKind,
    institutionId: null,
    countryCode,
    currencyCode,
    openingBalance: 0n,
    openingDate: nowIso().slice(0, 10),
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
    createdBy: DEMO_USER_ID,
  });

  return { householdId: household.id, accountId: account.id };
}
