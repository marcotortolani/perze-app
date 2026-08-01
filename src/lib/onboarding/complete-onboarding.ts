import { accountsRepo } from "../repos/accounts-repo";
import { categoriesRepo } from "../repos/categories-repo";
import { householdsRepo } from "../repos/households-repo";
import { nowIso } from "../repos/ids";
import { BASIC_CATEGORY_TEMPLATE } from "../reference/category-templates";
import type { AccountKind, EnabledModule } from "../db/schema";
import type { HouseholdUsage } from "@/stores/onboarding-store";

export interface CompleteOnboardingParams {
  /**
   * `auth.uid()` del usuario ya logueado (C7) — sin esto, cada `created_by`
   * quedaría con un id que nunca coincide con ninguna sesión real, y el
   * outbox (BASE-05) fallaría por RLS en el primer intento de sync.
   */
  userId: string;
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
export async function completeOnboarding({ userId, countryCode, currencyCode, usage, accountName, accountKind }: CompleteOnboardingParams): Promise<{ householdId: string; accountId: string }> {
  // "pareja" y "familia" activan el módulo family — A5 lo promete
  // explícitamente para "pareja" ("Activa el grupo familiar"), no solo
  // para "familia". Solo "solo" queda sin ningún módulo encendido.
  const enabledModules: EnabledModule[] = usage === "solo" ? [] : ["family"];

  const household = await householdsRepo.create({
    name: "Mi hogar",
    baseCurrency: currencyCode,
    baseCountry: countryCode,
    periodStartDay: 1,
    weekStart: 1,
    enabledModules,
    settings: {},
    createdBy: userId,
  });

  await householdsRepo.setCurrentHouseholdId(household.id);
  await householdsRepo.addMember({
    householdId: household.id,
    profileId: userId,
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
      visibility: "household" as const,
      ownerId: null,
      createdBy: userId,
    }))
  );

  const account = await accountsRepo.create({
    householdId: household.id,
    ownerId: userId,
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
    createdBy: userId,
  });

  return { householdId: household.id, accountId: account.id };
}
