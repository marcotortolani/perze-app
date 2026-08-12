import { getDb } from "../db/client";
import type { HouseholdMemberRow, HouseholdRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { newId, nowIso } from "./ids";

const CURRENT_HOUSEHOLD_META_KEY = "currentHouseholdId";

export type NewHouseholdInput = Omit<HouseholdRow, "id" | "createdAt" | "updatedAt" | "clientRev" | "purgedAt">;

export const householdsRepo = {
  async get(id: string): Promise<HouseholdRow | undefined> {
    return getDb().households.get(id);
  },

  /**
   * Household switcher, fallback offline — la lista remota
   * (`households-remote.ts`) es la fuente principal (Dexie puede no tener
   * TODOS los households del usuario hasta que cada uno se hidrata), pero
   * sin red esto es lo único disponible. Después del fix de `hydrate.ts`
   * (PR 2), `households` local siempre trae la lista completa aunque las
   * tablas hijas solo estén hidratadas para el household activo.
   */
  async listLocal(): Promise<HouseholdRow[]> {
    return getDb().households.toArray();
  },

  async create(input: NewHouseholdInput): Promise<HouseholdRow> {
    const db = getDb();
    const now = nowIso();
    const row: HouseholdRow = { ...input, id: newId(), createdAt: now, updatedAt: now, clientRev: 1, purgedAt: null };
    // C4 — enqueue en la misma transacción que la escritura (ver nota en accounts-repo.ts).
    await db.transaction("rw", db.households, db.outbox, async () => {
      await db.households.add(row);
      await outbox.enqueue({ table: "households", op: "insert", entityId: row.id, payload: row, clientRev: row.clientRev });
    });
    return row;
  },

  async update(id: string, patch: Partial<HouseholdRow>): Promise<void> {
    const db = getDb();
    // C10 — clientRev real, ver la nota en accounts-repo.ts.
    await db.transaction("rw", db.households, db.outbox, async () => {
      const existing = await db.households.get(id);
      if (!existing) return;
      const nextRev = existing.clientRev + 1;
      const updated: HouseholdRow = { ...existing, ...patch, updatedAt: nowIso(), clientRev: nextRev };
      await db.households.put(updated);
      await outbox.enqueue({ table: "households", op: "update", entityId: id, payload: updated, clientRev: nextRev });
    });
  },

  async addMember(member: HouseholdMemberRow): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.householdMembers, db.outbox, async () => {
      await db.householdMembers.add(member);
      await outbox.enqueue({
        table: "household_members",
        op: "insert",
        entityId: `${member.householdId}:${member.profileId}`,
        payload: member,
        clientRev: 1,
      });
    });
  },

  async listMembers(householdId: string): Promise<HouseholdMemberRow[]> {
    return getDb().householdMembers.where("householdId").equals(householdId).toArray();
  },

  /**
   * Sin auth todavía, el "household activo" es una preferencia local en
   * `meta` — el día que haya sesión real, esto se reemplaza por
   * `profiles.default_household_id`.
   */
  async getCurrentHouseholdId(): Promise<string | undefined> {
    const row = await getDb().meta.get(CURRENT_HOUSEHOLD_META_KEY);
    return row?.value as string | undefined;
  },

  async setCurrentHouseholdId(id: string): Promise<void> {
    await getDb().meta.put({ key: CURRENT_HOUSEHOLD_META_KEY, value: id });
  },

  /**
   * C7 — guarda contra el household duplicado: si este dispositivo/navegador
   * no tiene household local (Dexie vacío) pero el usuario YA es miembro de
   * uno en el servidor, el onboarding NO debe crear uno segundo. No hay
   * pull-sync todavía (BASE-05, `household-members-remote.ts`) — esto no
   * trae los datos acá, solo detecta que existen para poder bloquear a
   * tiempo en vez de duplicar en silencio. `households_select` en RLS ya
   * filtra por membresía (`id IN (SELECT current_households())`), así que
   * cualquier fila que vuelva es un household real del usuario.
   */
  async hasRemoteHousehold(): Promise<boolean> {
    // Import dinámico — a diferencia del resto de este repo (puro Dexie),
    // esto es lo único acá que toca Supabase. `households-repo.ts` lo
    // importan tests que nunca llaman a este método y no mockean `@/env`
    // (`complete-onboarding.test.ts`); un import estático rompía esos
    // tests con "Invalid environment variables" en cuanto cargaba el
    // módulo, aunque nunca se ejecutara esta función.
    const { createClient } = await import("../supabase/client");
    const supabase = createClient();
    // AC-15 — la policy de SELECT ya no filtra `deleted_at` (a propósito,
    // fix de soft-delete RLS): sin este filtro, un household borrado
    // dispararía la restauración para siempre.
    const { data, error } = await supabase.from("households").select("id").is("deleted_at", null).limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },
};
