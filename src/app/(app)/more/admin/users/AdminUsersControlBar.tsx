"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, IconButton, Sheet } from "@/design-system";
import { SelectableRow } from "@/design-system/finance/SelectableRow";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { isDefaultCriteria, type SortDir, type SortField, type StatusFilter, type UsersCriteria } from "./filter-users";

const STATUS_OPTIONS: { value: StatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "adminPage.users.filterAll" },
  { value: "pending", labelKey: "adminPage.status.pending" },
  { value: "approved", labelKey: "adminPage.status.approved" },
  { value: "rejected", labelKey: "adminPage.status.rejected" },
  { value: "disabled", labelKey: "adminPage.status.disabled" },
];

const SORT_OPTIONS: { field: SortField; dir: SortDir; labelKey: string }[] = [
  { field: "requestedAt", dir: "desc", labelKey: "adminPage.users.sortNewestFirst" },
  { field: "requestedAt", dir: "asc", labelKey: "adminPage.users.sortOldestFirst" },
  { field: "lastSeenAt", dir: "desc", labelKey: "adminPage.users.sortNewestFirst" },
  { field: "lastSeenAt", dir: "asc", labelKey: "adminPage.users.sortOldestFirst" },
  { field: "name", dir: "asc", labelKey: "adminPage.users.sortAZ" },
  { field: "name", dir: "desc", labelKey: "adminPage.users.sortZA" },
];

function pillStyle(active: boolean) {
  return {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 6,
    background: active ? "var(--selection-surface)" : "var(--surface-2)",
    boxShadow: active ? "inset 0 0 0 1px var(--selection-ring)" : undefined,
    border: 0,
    borderRadius: "var(--radius-chip)",
    padding: "0 14px",
    height: 44,
    cursor: "pointer",
    flexShrink: 0,
  };
}

export interface AdminUsersControlBarProps {
  criteria: UsersCriteria;
  onQueryChange: (value: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onCountryChange: (country: string | null) => void;
  onSortChange: (field: SortField, dir: SortDir) => void;
  onClear: () => void;
  /** Países presentes en la lista completa (no en la filtrada) — la pill de país solo se muestra con >=3. */
  countries: string[];
  resultCount: number;
  totalCount: number;
  /** En desktop el orden se dispara desde el header de columnas, no desde acá — la pill de orden solo aparece en mobile/tablet. */
  showSortPill: boolean;
}

/**
 * Búsqueda + pills de estado + país (condicional) + orden (mobile) +
 * contador + limpiar. Vive fuera del scroller de la lista (`flexShrink: 0`).
 *
 * Pills, no `Chip` ni `SegmentedControl`: `SegmentedControl` está limitado a
 * 2-4 opciones por contrato (acá son 5) y `Chip` hardcodea `--primary-fill`
 * cuando está seleccionado — en esta pantalla el único violeta es el FAB del
 * shell (CLAUDE.md: "un solo violeta visible y es la acción primaria").
 */
export function AdminUsersControlBar({ criteria, onQueryChange, onStatusChange, onCountryChange, onSortChange, onClear, countries, resultCount, totalCount, showSortPill }: AdminUsersControlBarProps) {
  const t = useTranslations();
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const showClear = !isDefaultCriteria(criteria);
  const showCountryPill = countries.length >= 3;
  const activeSortLabel = SORT_OPTIONS.find((o) => o.field === criteria.sort && o.dir === criteria.dir)?.labelKey;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, paddingBottom: 12 }}>
      {/* Búsqueda — input nativo dentro de una píldora propia, no el `Input`
          del DS (48px, con label, sin ícono ni botón de limpiar: no es el
          componente para esto). `fontSize: 16` es obligatorio: por debajo
          iOS hace zoom automático al enfocar el campo. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, borderRadius: "var(--radius-chip)", background: "var(--surface-2)", padding: "0 12px" }}>
        <Icon name="search" size={16} color="var(--text-muted)" />
        <input
          value={criteria.query}
          onChange={(e) => onQueryChange(e.target.value)}
          inputMode="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("adminPage.users.searchPlaceholder")}
          aria-label={t("adminPage.users.searchPlaceholder")}
          style={{ minWidth: 0, flex: 1, border: 0, background: "transparent", fontSize: 16, color: "var(--text-primary)", outline: "none" }}
        />
        {criteria.query ? <IconButton icon="close" size={44} iconSize={16} ariaLabel={t("adminPage.users.searchClear")} onClick={() => onQueryChange("")} /> : null}
      </div>

      {/* Pills de estado + país + orden — scroll horizontal en mobile, nada
          se corta ni se envuelve en dos líneas. */}
      <div role="radiogroup" aria-label={t("adminPage.users.columnStatus")} style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
        {STATUS_OPTIONS.map((opt) => {
          const active = criteria.status === opt.value;
          return (
            <button key={opt.value} type="button" role="radio" aria-checked={active} onClick={() => onStatusChange(opt.value)} style={pillStyle(active)}>
              <span style={{ fontSize: 13, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>{t(opt.labelKey as Parameters<typeof t>[0])}</span>
            </button>
          );
        })}

        {showCountryPill ? (
          <button type="button" onClick={() => setCountrySheetOpen(true)} style={pillStyle(criteria.country !== null)}>
            <span style={{ fontSize: 13, color: criteria.country ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {criteria.country ? (criteria.country in COUNTRY_MESSAGE_KEY ? t(COUNTRY_MESSAGE_KEY[criteria.country as keyof typeof COUNTRY_MESSAGE_KEY]) : criteria.country) : t("adminPage.users.filterCountry")}
            </span>
            {criteria.country ? <Icon name="close" size={14} color="var(--text-primary)" /> : null}
          </button>
        ) : null}

        {showSortPill ? (
          <button type="button" onClick={() => setSortSheetOpen(true)} style={pillStyle(criteria.sort !== "requestedAt" || criteria.dir !== "desc")}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{activeSortLabel ? t(activeSortLabel as Parameters<typeof t>[0]) : t("adminPage.users.sort")}</span>
          </button>
        ) : null}
      </div>

      {/* Contador + limpiar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {isDefaultCriteria(criteria) ? t("adminPage.users.resultCount", { count: resultCount }) : t("adminPage.users.resultCountFiltered", { count: resultCount, total: totalCount })}
        </span>
        {showClear ? (
          <button type="button" onClick={onClear} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: 13, color: "var(--primary-ink)" }}>
            {t("adminPage.users.clearFilters")}
          </button>
        ) : null}
      </div>

      <Sheet open={countrySheetOpen} title={t("adminPage.users.filterCountryTitle")} onClose={() => setCountrySheetOpen(false)}>
        <div role="radiogroup" aria-label={t("adminPage.users.filterCountryTitle")} style={{ display: "flex", flexDirection: "column" }}>
          <SelectableRow
            label={t("adminPage.users.filterCountryAll")}
            selected={criteria.country === null}
            onChange={() => {
              onCountryChange(null);
              setCountrySheetOpen(false);
            }}
          />
          {countries.map((code) => (
            <SelectableRow
              key={code}
              label={code in COUNTRY_MESSAGE_KEY ? t(COUNTRY_MESSAGE_KEY[code as keyof typeof COUNTRY_MESSAGE_KEY]) : code}
              selected={criteria.country === code}
              onChange={() => {
                onCountryChange(code);
                setCountrySheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={sortSheetOpen} title={t("adminPage.users.sortTitle")} onClose={() => setSortSheetOpen(false)}>
        <div role="radiogroup" aria-label={t("adminPage.users.sortTitle")} style={{ display: "flex", flexDirection: "column" }}>
          {SORT_OPTIONS.map((opt) => (
            <SelectableRow
              key={`${opt.field}:${opt.dir}`}
              label={t(opt.labelKey as Parameters<typeof t>[0])}
              meta={t(
                (opt.field === "name" ? "adminPage.users.sortByUser" : opt.field === "requestedAt" ? "adminPage.users.sortByRequested" : "adminPage.users.sortByLastSeen") as Parameters<typeof t>[0],
              )}
              selected={criteria.sort === opt.field && criteria.dir === opt.dir}
              onChange={() => {
                onSortChange(opt.field, opt.dir);
                setSortSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
