import { getDb } from "../db/client";
import type { HouseholdMemberRow, HouseholdRow } from "../db/schema";
import { newId, nowIso } from "./ids";

const CURRENT_HOUSEHOLD_META_KEY = "currentHouseholdId";

export type NewHouseholdInput = Omit<HouseholdRow, "id" | "createdAt" | "updatedAt">;

export const householdsRepo = {
  async get(id: string): Promise<HouseholdRow | undefined> {
    return getDb().households.get(id);
  },

  async create(input: NewHouseholdInput): Promise<HouseholdRow> {
    const now = nowIso();
    const row: HouseholdRow = { ...input, id: newId(), createdAt: now, updatedAt: now };
    await getDb().households.add(row);
    return row;
  },

  async update(id: string, patch: Partial<HouseholdRow>): Promise<void> {
    await getDb().households.update(id, { ...patch, updatedAt: nowIso() });
  },

  async addMember(member: HouseholdMemberRow): Promise<void> {
    await getDb().householdMembers.add(member);
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
};
