import { getDb } from "../db/client";
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
 *
 * B6 — antes eran 5 `await` sueltos sin transacción ni try/catch, con
 * `setCurrentHouseholdId` en el paso 2: un fallo entre el 2 y el 5 dejaba
 * un household "activo" sin cuenta ni member, estado irrecuperable desde
 * la UI (el onboarding no vuelve a ofrecerse). Ahora todo corre dentro de
 * una sola transacción de Dexie — cada repo ya abre su propio
 * `db.transaction(...)`, que Dexie une automáticamente a esta transacción
 * externa en vez de abrir una nueva, así que si cualquier paso tira, TODO
 * se revierte (nunca queda un household a medias). `setCurrentHouseholdId`
 * se mueve al final: solo se marca "activo" un household completo.
 */
export async function completeOnboarding({ userId, countryCode, currencyCode, usage, accountName, accountKind }: CompleteOnboardingParams): Promise<{ householdId: string; accountId: string }> {
  // "pareja" y "familia" activan el módulo family — A5 lo promete
  // explícitamente para "pareja" ("Activa el grupo familiar"), no solo
  // para "familia". Solo "solo" queda sin ningún módulo encendido.
  const enabledModules: EnabledModule[] = usage === "solo" ? [] : ["family"];

  const db = getDb();
  let result!: { householdId: string; accountId: string };

  // Dexie tipa `transaction()` con overloads de hasta 5 tablas individuales
  // — con 6 (households/householdMembers/categories/accounts/outbox/meta)
  // hace falta la forma de array.
  await db.transaction(
    "rw",
    [db.households, db.householdMembers, db.categories, db.accounts, db.outbox, db.meta],
    async () => {
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

      // Último paso, adentro de la misma transacción: si algo de arriba
      // falló, esto nunca corre y no queda ningún household "activo" a medias.
      await householdsRepo.setCurrentHouseholdId(household.id);

      result = { householdId: household.id, accountId: account.id };
    }
  );

  return result;
}
