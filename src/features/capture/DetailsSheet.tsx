"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AccountCarousel, Chip, DateStrip, Input, ListRow, Sheet, Switch } from "@/design-system";
import { todayIso as todayIsoLocal } from "@/lib/dates/today";
import type { AccountRow, PayeeRow, TagRow } from "@/lib/db/schema";
import type { CaptureDraft } from "@/stores/capture-draft-store";
import { findExistingTagByName } from "./create-tag";

export interface DetailsSheetProps {
  open: boolean;
  onClose: () => void;
  draft: CaptureDraft;
  accounts: AccountRow[];
  onSetField: <K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) => void;
  /** Ítem 7 — todas las etiquetas del household, para la grilla completa detrás de "Otras". */
  tags: TagRow[];
  /** Top-5 por uso real (`useFrequentTags`, calculado en el caller igual que las categorías). */
  frequentTags: TagRow[];
  onCreateTag: (name: string) => Promise<TagRow>;
  /** Catálogo de comercios del household — para el autocompletado de "Comercio". */
  payees: PayeeRow[];
  /** Top-5 por uso real (`useFrequentPayees`), sugeridos con el campo vacío. */
  frequentPayees: PayeeRow[];
}

/**
 * D10 — `centerIso` es una fecha calendario ("YYYY-MM-DD"), no un instante:
 * la aritmética tiene que quedarse en UTC de punta a punta (`Date.UTC` +
 * getters/setters `UTC*`). Mezclar un instante UTC (`new Date("2026-08-01")`
 * = medianoche UTC) con `getDate()`/`setDate()` (hora local del runtime)
 * corría un día entero para cualquier huso horario negativo — América
 * entera — en el borde del mes.
 */
function isoDaysAround(centerIso: string, span = 3): string[] {
  const [y, m, d] = centerIso.split("-").map(Number);
  const center = Date.UTC(y!, m! - 1, d!);
  return Array.from({ length: span * 2 + 1 }, (_, i) => {
    const day = new Date(center);
    day.setUTCDate(day.getUTCDate() - span + i);
    return day.toISOString().slice(0, 10);
  });
}

function dayLabel(iso: string, todayIso: string, labels: { today: string; yesterday: string }): string | undefined {
  if (iso === todayIso) return labels.today;
  const [y, m, d] = todayIso.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y!, m! - 1, d!));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return labels.yesterday;
  return undefined;
}

/**
 * Etiquetas del movimiento — multi-select (`draft.tagIds`, a diferencia de
 * la categoría que es una sola), así que tocar una NUNCA cierra nada: solo
 * la prende/apaga. La fila normal muestra las 5 más usadas + un chip
 * final que cambia de sentido según haya algo más detrás:
 * - Con más de 5 etiquetas en total, dice "Otras" — hay algo real para
 *   descubrir — y abre la grilla completa (mismo patrón que `CategoryStep`,
 *   sin el long-press porque acá no hay jerarquía).
 * - Con 5 o menos, `frequentTags` YA muestra todas — "Otras" sería
 *   mentira, no hay nada más — así que dice "Crear etiqueta" y va directo
 *   a esa grilla (la misma) con el buscador enfocado, porque ahí la única
 *   acción que tiene sentido es escribir un nombre nuevo.
 */
function TagsField({ tags, frequentTags, selectedIds, onToggle, onCreate }: { tags: TagRow[]; frequentTags: TagRow[]; selectedIds: string[]; onToggle: (id: string) => void; onCreate: (name: string) => Promise<TagRow> }) {
  const t = useTranslations();
  const [allOpen, setAllOpen] = useState(false);
  const [focusSearchOnOpen, setFocusSearchOnOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const selected = new Set(selectedIds);
  const exactMatch = query.trim() !== "" && findExistingTagByName(query, tags) !== undefined;
  const hasMore = tags.length > frequentTags.length;

  useEffect(() => {
    if (allOpen && focusSearchOnOpen) {
      searchWrapperRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      // Consume la bandera — sincronización genuina con "ya enfoqué",
      // no derivable del render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusSearchOnOpen(false);
    }
  }, [allOpen, focusSearchOnOpen]);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      onToggle(created.id);
      setQuery("");
    } finally {
      setCreating(false);
    }
  };

  if (allOpen) {
    return (
      <div>
        <ListRow icon="chevron-left" label={t("capture.details_sheet.tagsBack")} chevron={false} onClick={() => setAllOpen(false)} style={{ marginTop: -4, marginBottom: 8 }} />
        <div ref={searchWrapperRef}>
          <Input placeholder={t("capture.details_sheet.tagsSearchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} style={{ marginBottom: 12 }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.map((tag) => (
            <Chip key={tag.id} icon="tag" selected={selected.has(tag.id)} onClick={() => onToggle(tag.id)}>
              {tag.name}
            </Chip>
          ))}
        </div>
        {query.trim() !== "" && !exactMatch ? (
          <ListRow icon="plus" variant="action" label={t("capture.category.createNew", { name: query.trim() })} disabled={creating} onClick={handleCreate} style={{ marginTop: 8 }} />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
        {t("capture.details_sheet.tags")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {frequentTags.map((tag) => (
          <Chip key={tag.id} icon="tag" selected={selected.has(tag.id)} onClick={() => onToggle(tag.id)}>
            {tag.name}
          </Chip>
        ))}
        <Chip
          icon={hasMore ? "more" : "plus"}
          onClick={() => {
            setAllOpen(true);
            if (!hasMore) setFocusSearchOnOpen(true);
          }}
        >
          {hasMore ? t("capture.details_sheet.tagsOther") : t("capture.details_sheet.tagsAddNew")}
        </Chip>
      </div>
    </div>
  );
}

/**
 * Comercio — autocompletado sobre el catálogo del household
 * (`payeesRepo`/`resolvePayeeId`). A diferencia de `TagsField` no hay
 * grilla completa detrás de un "Otras": es un solo campo de texto, y las
 * sugerencias son un atajo para no re-tipear un nombre ya usado, no un
 * selector obligatorio — el texto libre siempre es válido y se guarda
 * igual (`resolvePayeeId` crea el comercio si no existe).
 *
 * Con el campo vacío, muestra las 5 más usadas (`frequentPayees`); al
 * tipear, filtra por prefijo sobre nombre y aliases. Tocar un chip
 * completa el campo Y fija `payeeId` (evita una búsqueda redundante al
 * guardar y es inmune a que el nombre tipeado coincida por casualidad con
 * otro comercio) — escribir a mano siempre limpia `payeeId`, el texto deja
 * de ser necesariamente ESE comercio.
 */
function PayeeField({
  payees,
  frequentPayees,
  name,
  payeeId,
  onChange,
}: {
  payees: PayeeRow[];
  frequentPayees: PayeeRow[];
  name: string;
  payeeId: string | null;
  /** `defaultCategoryId` solo viaja al elegir un chip — el caller decide si le sirve (nunca pisa una categoría ya elegida a mano). */
  onChange: (next: { name: string; payeeId: string | null; defaultCategoryId?: string | null }) => void;
}) {
  const t = useTranslations();
  const query = name.trim().toLowerCase();
  const suggestions =
    query === ""
      ? frequentPayees
      : payees.filter((p) => p.name.toLowerCase().startsWith(query) || p.aliases.some((a) => a.toLowerCase().startsWith(query))).slice(0, 5);

  return (
    <div>
      <Input
        label={t("capture.details_sheet.payee")}
        value={name}
        onChange={(e) => onChange({ name: e.target.value, payeeId: null })}
        placeholder={t("capture.details_sheet.payeePlaceholder")}
      />
      {suggestions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {suggestions.map((p) => (
            <Chip key={p.id} icon="storefront" selected={payeeId === p.id} onClick={() => onChange({ name: p.name, payeeId: p.id, defaultCategoryId: p.defaultCategoryId })}>
              {p.name}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** C3 — detalles colapsados: etiquetas, cuenta, fecha, comercio, nota. Todo con default, ninguna fila obligatoria. */
export function DetailsSheet({ open, onClose, draft, accounts, onSetField, tags, frequentTags, onCreateTag, payees, frequentPayees }: DetailsSheetProps) {
  const t = useTranslations();
  const todayIso = todayIsoLocal(); // D10 — día calendario local, no UTC
  const dateValue = draft.occurredAt.slice(0, 10);
  const dayLabels = { today: t("capture.details_sheet.today"), yesterday: t("capture.details_sheet.yesterday") };
  const days = isoDaysAround(todayIso).map((date) => ({ date, label: dayLabel(date, todayIso, dayLabels) }));

  const toggleTag = (id: string) => {
    const current = draft.tagIds;
    onSetField("tagIds", current.includes(id) ? current.filter((t2) => t2 !== id) : [...current, id]);
  };

  return (
    <Sheet open={open} title={t("capture.details_sheet.title")} onClose={onClose} height={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        <TagsField tags={tags} frequentTags={frequentTags} selectedIds={draft.tagIds} onToggle={toggleTag} onCreate={onCreateTag} />
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.details_sheet.account")}
          </p>
          <AccountCarousel
            accounts={accounts.map((a) => ({ id: a.id, institution: a.name, name: a.kind, balance: { amount: a.currentBalance, currency: a.currencyCode }, country: a.countryCode ?? undefined }))}
            activeId={draft.accountId ?? undefined}
            onSelect={(id) => onSetField("accountId", id)}
          />
        </div>
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.details_sheet.date")}
          </p>
          <DateStrip days={days} value={dateValue} onChange={(date) => onSetField("occurredAt", `${date}T12:00:00.000Z`)} />
        </div>
        <PayeeField
          payees={payees}
          frequentPayees={frequentPayees}
          name={draft.payeeName}
          payeeId={draft.payeeId}
          onChange={({ name, payeeId, defaultCategoryId }) => {
            onSetField("payeeName", name);
            onSetField("payeeId", payeeId);
            // Una elección explícita de categoría nunca se pisa — mismo
            // criterio que la auto-categorización por reglas.
            if (payeeId && defaultCategoryId && !draft.categoryId) {
              onSetField("categoryId", defaultCategoryId);
            }
          }}
        />
        <Input label={t("capture.details_sheet.note")} value={draft.note} onChange={(e) => onSetField("note", e.target.value)} multiline placeholder={t("capture.details_sheet.notePlaceholder")} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{t("capture.details_sheet.burstMode")}</span>
          <Switch checked={draft.burstMode} onChange={(checked) => onSetField("burstMode", checked)} id="burst-switch" />
        </div>
      </div>
    </Sheet>
  );
}
