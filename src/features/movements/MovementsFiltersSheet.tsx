"use client";

import { useTranslations } from "next-intl";
import { Button, Chip, Sheet, Switch } from "@/design-system";
import type { AccountRow, CategoryRow, TagRow } from "@/lib/db/schema";
import { useCategoryLabel } from "@/hooks/use-category-label";

export type DatePreset = "all" | "this-month" | "last-month" | "last-7" | "last-30";
export type KindFilter = "all" | "expense" | "income" | "transfer" | "adjustment";

export interface MovementsFilters {
  datePreset: DatePreset;
  kind: KindFilter;
  accountIds: string[];
  categoryIds: string[];
  tagIds: string[];
  onlyPending: boolean;
}

export function defaultMovementsFilters(): MovementsFilters {
  return { datePreset: "all", kind: "all", accountIds: [], categoryIds: [], tagIds: [], onlyPending: false };
}

/**
 * `dateOwnedByCalendar`: con la vista de calendario abierta el rango lo manda
 * el mes o el día elegido en la grilla, que se escribe en los params
 * `from`/`to` y le gana al preset (ver `calendar-scope.ts`). Contar el preset
 * ahí sería contar un filtro que no está haciendo nada.
 */
export function countActiveFilters(f: MovementsFilters, dateOwnedByCalendar = false): number {
  let n = 0;
  if (!dateOwnedByCalendar && f.datePreset !== "all") n += 1;
  if (f.kind !== "all") n += 1;
  if (f.accountIds.length > 0) n += 1;
  if (f.categoryIds.length > 0) n += 1;
  if (f.tagIds.length > 0) n += 1;
  if (f.onlyPending) n += 1;
  return n;
}

export interface MovementsFiltersSheetProps {
  open: boolean;
  onClose: () => void;
  filters: MovementsFilters;
  onChange: (filters: MovementsFilters) => void;
  accounts: AccountRow[];
  categories: CategoryRow[];
  tags: TagRow[];
  resultCount: number;
  /**
   * Oculta la sección de período. Con el calendario abierto el rango sale de
   * la grilla y le gana al preset, así que dejar los chips visibles sería una
   * mentira: se toca "último mes" y no pasa nada.
   */
  dateOwnedByCalendar?: boolean;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * D2 — recorte deliberado: quedan afuera el rango de monto (doble slider),
 * países, miembros y "con adjunto" — ninguno tiene datos reales para
 * ejercitar todavía en esta versión (household de un solo miembro, sin
 * adjuntos). Fecha, cuentas, categorías, etiquetas, tipo y pendientes sí,
 * porque son los que separan casos reales en el seed de demo. Etiquetas se
 * dibuja debajo de categorías, y solo si el household ya tiene alguna —
 * sin eso, la sección quedaría siempre vacía.
 */
export function MovementsFiltersSheet({ open, onClose, filters, onChange, accounts, categories, tags, resultCount, dateOwnedByCalendar = false }: MovementsFiltersSheetProps) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();

  const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
    { id: "all", label: t("movements.filters.date.all") },
    { id: "this-month", label: t("movements.filters.date.thisMonth") },
    { id: "last-month", label: t("movements.filters.date.lastMonth") },
    { id: "last-7", label: t("movements.filters.date.last7") },
    { id: "last-30", label: t("movements.filters.date.last30") },
  ];

  const KIND_PRESETS: Array<{ id: KindFilter; label: string }> = [
    { id: "all", label: t("movements.filters.kindAll") },
    { id: "expense", label: t("capture.kind.expense") },
    { id: "income", label: t("capture.kind.income") },
    { id: "transfer", label: t("capture.kind.transfer") },
    { id: "adjustment", label: t("transactions.list.reconciliation") },
  ];

  return (
    <Sheet open={open} title={t("movements.filters.title")} onClose={onClose} height={620}>
      {/* `height: "100%"` llena exacto el contenedor de scroll que ya pone
          `Sheet` — así el único scroll real queda en el hijo de abajo
          (`flex: 1; overflowY: auto`), y los botones (`flexShrink: 0`)
          quedan siempre visibles como footer, sin un segundo scrollbar
          anidado compitiendo con el de `Sheet`. */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {dateOwnedByCalendar ? null : (
          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
              {t("movements.filters.period")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DATE_PRESETS.map((p) => (
                <Chip key={p.id} selected={filters.datePreset === p.id} onClick={() => onChange({ ...filters, datePreset: p.id })}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("movements.filters.type")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KIND_PRESETS.map((k) => (
              <Chip key={k.id} selected={filters.kind === k.id} onClick={() => onChange({ ...filters, kind: k.id })}>
                {k.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("movements.filters.accounts")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {accounts.map((a) => (
              <Chip key={a.id} selected={filters.accountIds.includes(a.id)} onClick={() => onChange({ ...filters, accountIds: toggle(filters.accountIds, a.id) })}>
                {a.name}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("movements.filters.categories")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <Chip key={c.id} selected={filters.categoryIds.includes(c.id)} onClick={() => onChange({ ...filters, categoryIds: toggle(filters.categoryIds, c.id) })}>
                {categoryLabel(c)}
              </Chip>
            ))}
          </div>
        </div>

        {tags.length > 0 ? (
          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
              {t("movements.filters.tags")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <Chip key={tag.id} icon="tag" selected={filters.tagIds.includes(tag.id)} onClick={() => onChange({ ...filters, tagIds: toggle(filters.tagIds, tag.id) })}>
                  {tag.name}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{t("movements.filters.onlyPending")}</span>
            <Switch checked={filters.onlyPending} onChange={(checked) => onChange({ ...filters, onlyPending: checked })} id="only-pending-switch" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexShrink: 0 }}>
          <Button variant="secondary" onClick={() => onChange(defaultMovementsFilters())} style={{ flex: 1 }}>
            {t("movements.filters.clearAll")}
          </Button>
          <Button onClick={onClose} style={{ flex: 2 }}>
            {t("movements.filters.seeResults", { count: resultCount })}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
