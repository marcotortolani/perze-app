"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Card, EmptyState, ErrorState, ListRow, OptionCard, SegmentedControl, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useArchivedCategories, useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTransactions, useInvalidateTransactions } from "@/hooks/use-transactions";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { householdsRepo } from "@/lib/repos/households-repo";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { applyCategoryTemplate, type CategoryTemplateChoice } from "@/lib/onboarding/apply-category-template";
import { mergeDuplicateCategories } from "@/lib/categories/merge-duplicate-categories";
import { buildCategoryUsageIndex, collectSubtree, isDeletable, subtreeUsage } from "@/lib/categories/category-usage";
import { BASIC_CATEGORY_TEMPLATE, COMPLETE_CATEGORY_TEMPLATE, type CategoryTemplateItem } from "@/lib/reference/category-templates";
import { CATEGORY_MESSAGE_KEY } from "@/lib/reference/category-i18n";
import { buildNewCategoryInput, findExistingCategoryByName } from "@/features/capture/create-category";
import { CategorySheet, type CategorySheetTarget } from "@/features/categories/CategorySheet";
import type { CategoryKind, CategoryRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import type { IconName } from "@/design-system/core/Icon";

const TEMPLATE_CHOICES: CategoryTemplateChoice[] = ["basic", "complete", "scratch"];

/**
 * `households.settings` (jsonb, ya sincroniza a Supabase — comentario de
 * la migración: "tema, acento, intensidad de animación, modo privacidad")
 * es donde vive esta preferencia: antes el `useState` arrancaba siempre en
 * "basic" y se olvidaba apenas se salía de la pantalla, aunque el usuario
 * hubiera elegido "completa" la vez anterior — ahora acompaña a la cuenta
 * entre dispositivos, no queda solo en este navegador.
 */
function templateChoiceFrom(settings: Record<string, unknown>): CategoryTemplateChoice {
  const stored = settings.categoryTemplateChoice;
  return typeof stored === "string" && (TEMPLATE_CHOICES as string[]).includes(stored) ? (stored as CategoryTemplateChoice) : "basic";
}

function countTemplateItems(items: typeof BASIC_CATEGORY_TEMPLATE): number {
  return items.reduce((sum, item) => sum + 1 + (item.children?.length ?? 0), 0);
}

/**
 * Nombres reales de la plantilla, para la opción seleccionada — antes solo
 * se veía un conteo ("21 categorías"), sin saber cuáles son. Los ítems con
 * subcategorías van en su propia línea con las hijas debajo; el resto se
 * agrupa en una línea final separada por "·".
 */
function CategoryTemplatePreview({ items }: { items: CategoryTemplateItem[] }) {
  const t = useTranslations();
  // El `name` de la plantilla es el fallback que se persiste en la fila, no
  // lo que se muestra: acá se traduce por `i18nKey`, igual que hace
  // `useCategoryLabel()` con las categorías ya creadas. Sin esto la preview
  // listaba "Supermercado · Verdulería · Carnicería" con la app en inglés.
  const label = (item: CategoryTemplateItem) => t(CATEGORY_MESSAGE_KEY[item.i18nKey]);
  const withChildren = items.filter((item) => item.children && item.children.length > 0);
  const withoutChildren = items.filter((item) => !item.children || item.children.length === 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, marginBottom: 4, paddingLeft: 14, borderLeft: "2px solid var(--border)" }}>
      {withChildren.map((item) => (
        <div key={item.i18nKey}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label(item)}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {item.children!.map((child) => label(child)).join(" · ")}
          </span>
        </div>
      ))}
      {withoutChildren.length > 0 ? (
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{withoutChildren.map((item) => label(item)).join(" · ")}</span>
      ) : null}
    </div>
  );
}

/**
 * Las 3 opciones + subtítulo + botón de aplicar — extraído para
 * reutilizarse en los dos lugares donde puede aparecer: inline la primera
 * vez (antes de que el household haya aplicado explícitamente una
 * plantilla) y dentro de un `Sheet` bajo demanda después ("Cambiar
 * plantilla"), nunca las dos formas a la vez.
 */
function TemplatePicker({
  choice,
  onChoice,
  onApply,
  applying,
  applyVariant,
}: {
  choice: CategoryTemplateChoice;
  onChoice: (choice: CategoryTemplateChoice) => void;
  onApply: () => void;
  applying: boolean;
  /** `secondary` la primera vez (comparte pantalla con "Nueva categoría", que es la única acción primaria); `primary` dentro del sheet de "Cambiar plantilla", donde es la única acción. */
  applyVariant: "primary" | "secondary";
}) {
  const t = useTranslations();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
        {t("categoryTemplate.subtitle")}
      </p>
      <div style={{ height: 6 }} />
      <OptionCard
        title={t("categoryTemplate.basicTitle")}
        description={t("categoryTemplate.basicCount", { count: countTemplateItems(BASIC_CATEGORY_TEMPLATE) })}
        selected={choice === "basic"}
        onClick={() => onChoice("basic")}
      />
      {choice === "basic" ? <CategoryTemplatePreview items={BASIC_CATEGORY_TEMPLATE} /> : null}
      <OptionCard
        title={t("categoryTemplate.completeTitle")}
        description={`${t("categoryTemplate.completeCount", { count: countTemplateItems(COMPLETE_CATEGORY_TEMPLATE) })} — ${t("categoryTemplate.completeDescription")}`}
        selected={choice === "complete"}
        onClick={() => onChoice("complete")}
      />
      {choice === "complete" ? <CategoryTemplatePreview items={COMPLETE_CATEGORY_TEMPLATE} /> : null}
      <OptionCard title={t("categoryTemplate.scratchTitle")} description={t("categoryTemplate.scratchDescription")} selected={choice === "scratch"} onClick={() => onChoice("scratch")} />
      <Button variant={applyVariant} onClick={onApply} disabled={applying}>
        {t("categoryTemplate.save")}
      </Button>
    </div>
  );
}

/**
 * K5 — gestor completo de categorías (Ajustes → Categorías). Antes era
 * solo un selector de plantilla con un listado lateral que ocultaba las
 * categorías `isSystem` (todas las que vienen de la plantilla) y no
 * ofrecía crear ni subcategorizar. Ahora: árbol completo por
 * gastos/ingresos, crear raíz o subcategoría, editar cualquiera (incluidas
 * las de plantilla — copy-on-write en el repo), y archivar en cascada. El
 * selector de plantilla sigue siendo el punto de partida, ahora en
 * segundo plano.
 */
export default function CategoryManagerPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  // `useEffectiveUserId` y no `useCurrentUserId`: esta pantalla ESCRIBE
  // (crea, edita, archiva y borra categorías), y el modo demo nunca crea
  // sesión de Supabase — con el hook crudo, `userId` queda en `null` para
  // siempre y la barrera de carga de abajo deja la pantalla en skeleton
  // eternamente. Es el caso que el propio `use-current-user.ts` documenta.
  const userId = useEffectiveUserId();
  const categoriesQuery = useCategories(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const t = useTranslations();

  const errorState = useQueryErrorState(categoriesQuery.isError ? categoriesQuery : transactionsQuery, { what: t("categoryTemplate.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !categoriesQuery.data || !transactionsQuery.data || !userId) {
    return (
      <div style={{ paddingTop: 16 }}>
        <Skeleton width={160} height={20} style={{ marginBottom: 20 }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={100} />
      </div>
    );
  }

  return (
    <CategoryManagerForm household={household} categories={categoriesQuery.data} transactions={transactionsQuery.data} userId={userId} onBack={() => router.back()} />
  );
}

/**
 * Árbol de categorías de un `kind` — cada raíz (con sus hijas debajo,
 * indentadas, siempre expandidas) es un bloque independiente. En mobile es
 * la lista de siempre; en desktop se reparte en 2 columnas.
 *
 * A propósito NO es un CSS Grid de 2 columnas: un grid fuerza a cada FILA a
 * la altura de su bloque más alto — "Restaurantes" (sin hijas) al lado de
 * "Salud" (3 hijas) queda estirado con hueco muerto abajo, y todo lo que
 * sigue se corre una fila entera por ese hueco. Es un `columns-2` real
 * (mismo mecanismo que un masonry de Pinterest): cada bloque ocupa solo su
 * propia altura, y el que sigue en la columna sube a ocupar el espacio
 * libre. El costo es el orden visual: en vez de fila por fila (izq→der,
 * abajo), pasa a ser columna por columna (la 1ª mitad de las raíces llena
 * la columna izquierda de arriba a abajo, la 2ª mitad la derecha) — es
 * inherente a cómo funciona un masonry, no hay forma de "reordenar para
 * llenar el hueco" preservando el orden fila por fila.
 *
 * No disclosure: el tope real es ~40 filas, y esconder subcategorías
 * escondería justo lo que el usuario vino a administrar. Una hija cuyo
 * padre no está en la lista (archivado en otro dispositivo, hidratado a
 * medias) se muestra como raíz en vez de desaparecer — recuperable en vez
 * de fantasma.
 */
function CategoryTree({
  categories,
  kind,
  movementCounts,
  onEdit,
  twoColumns,
}: {
  categories: CategoryRow[];
  kind: CategoryKind;
  movementCounts: Map<string, number>;
  onEdit: (category: CategoryRow) => void;
  /**
   * `false` mientras el panel de plantilla todavía ocupa la mitad de la
   * pantalla (primera vez) — a ese ancho, anidar OTRO grid de 2 columnas
   * adentro de la mitad izquierda dejaría cada bloque angustiosamente
   * angosto. Una vez que el árbol tiene el ancho completo (plantilla ya
   * aplicada), sí aprovecha las 2 columnas.
   */
  twoColumns: boolean;
}) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const filtered = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind]);
  const roots = useMemo(() => filtered.filter((c) => c.parentId === null || !byId.has(c.parentId)), [filtered, byId]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, CategoryRow[]>();
    for (const c of filtered) {
      if (c.parentId && byId.has(c.parentId)) map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
    }
    return map;
  }, [filtered, byId]);

  const metaFor = (category: CategoryRow, children: CategoryRow[]) => {
    const parts = [t("categoryTemplate.movementsMeta", { count: movementCounts.get(category.id) ?? 0 })];
    if (children.length > 0) parts.push(t("categoryTemplate.subcategoriesMeta", { count: children.length }));
    return parts.join(" · ");
  };

  if (roots.length === 0) {
    return (
      <p className="t-body" style={{ margin: "8px 0", color: "var(--text-muted)" }}>
        {t("categoryTemplate.listEmpty")}
      </p>
    );
  }

  return (
    <div className={twoColumns ? "lg:columns-2" : undefined} style={twoColumns ? { columnGap: 8 } : { display: "flex", flexDirection: "column", gap: 8 }}>
      {roots.map((category) => {
        const children = childrenOf.get(category.id) ?? [];
        return (
          // `break-inside-avoid` — sin esto, un `columns-2` puede partir un
          // bloque (raíz + hijas) entre el fondo de una columna y el
          // arranque de la otra. `mb-2` reemplaza el `gap` del contenedor:
          // un `columns` layout no soporta `row-gap` entre bloques
          // apilados dentro de la misma columna, solo `column-gap` entre
          // columnas.
          <Card key={category.id} padding="4px 12px" className={twoColumns ? "mb-2 break-inside-avoid" : undefined}>
            <ListRow icon={category.icon as IconName} label={categoryLabel(category)} meta={metaFor(category, children)} onClick={() => onEdit(category)} />
            {children.map((child) => (
              <div key={child.id} style={{ paddingLeft: 28 }}>
                <ListRow icon={child.icon as IconName} label={categoryLabel(child)} meta={metaFor(child, [])} onClick={() => onEdit(child)} />
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Las archivadas, con la misma jerarquía que el árbol activo.
 *
 * Antes era una lista plana, y con duplicados era imposible saber de cuál
 * "Salud" colgaba cada "Farmacia" — la archivada o la activa. Eso importa
 * porque borrar exige el camino inverso al de archivar: archivar arrastra a
 * las hijas, así que borrar va de la hoja hacia la raíz, y sin ver el vínculo
 * la madre parecía bloqueada sin motivo.
 *
 * Una hija cuya madre NO está archivada (se archivó solo la hoja) no tiene
 * bajo qué anidarse: va al primer nivel, pero diciendo de quién viene.
 */
function ArchivedCategoryTree({
  archived,
  activeById,
  onEdit,
}: {
  archived: CategoryRow[];
  activeById: Map<string, CategoryRow>;
  onEdit: (category: CategoryRow) => void;
}) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const archivedById = new Map(archived.map((c) => [c.id, c]));
  const roots = archived.filter((c) => c.parentId === null || !archivedById.has(c.parentId));
  const childrenOf = new Map<string, CategoryRow[]>();
  for (const c of archived) {
    if (c.parentId && archivedById.has(c.parentId)) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
  }

  const rowFor = (category: CategoryRow, meta: string | undefined) => (
    <ListRow
      icon={(category.icon as IconName) ?? "tag"}
      label={categoryLabel(category)}
      {...(meta ? { meta } : {})}
      onClick={() => onEdit(category)}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {roots.map((category) => {
        const children = childrenOf.get(category.id) ?? [];
        // Huérfana: su madre existe pero no está archivada. Se dice de quién
        // viene, que es la única forma de distinguir dos hijas homónimas.
        const activeParent = category.parentId ? activeById.get(category.parentId) : undefined;
        const meta = activeParent
          ? t("categoryTemplate.archivedChildOf", { parent: categoryLabel(activeParent) })
          : children.length > 0
            ? t("categoryTemplate.subcategoriesMeta", { count: children.length })
            : undefined;
        return (
          <Card key={category.id} padding="4px 12px" style={{ opacity: 0.55 }}>
            {rowFor(category, meta)}
            {children.map((child) => (
              <div key={child.id} style={{ paddingLeft: 28 }}>
                {rowFor(child, undefined)}
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Separado del wrapper de arriba a propósito: `useState(templateChoiceFrom(household.settings))`
 * solo lee el valor guardado correctamente si `household` YA está cargado
 * en el primer render de este componente — con el `useState` en el
 * wrapper (que también renderiza mientras `household` es `undefined`),
 * React fija el default "basic" en el montaje y nunca lo vuelve a leer
 * aunque el household llegue después.
 */
function CategoryManagerForm({
  household,
  categories,
  transactions,
  userId,
  onBack,
}: {
  household: HouseholdRow;
  categories: CategoryRow[];
  transactions: TransactionRow[];
  userId: string;
  onBack: () => void;
}) {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const invalidateCategories = useInvalidateCategories(household.id);
  const { data: archivedCategories = [] } = useArchivedCategories(household.id);
  const queryClient = useQueryClient();
  // Borrar o restaurar cambia qué referencia a qué, así que el índice de uso
  // se recalcula junto con las listas.
  const invalidateUsage = () => queryClient.invalidateQueries({ queryKey: ["category-usage", household.id] });
  const invalidateHousehold = useInvalidateHousehold();
  const invalidateTransactions = useInvalidateTransactions(household.id);
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const [choice, setChoice] = useState<CategoryTemplateChoice>(() => templateChoiceFrom(household.settings));
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [sheetTarget, setSheetTarget] = useState<CategorySheetTarget | null>(null);
  // El módulo de las 3 opciones (Básica/Completa/Empezar de cero) se
  // muestra UNA sola vez: mientras el household nunca aplicó ninguna
  // explícitamente (`categoryTemplateChoice` sin escribir en `settings`),
  // ocupa la columna derecha. Apenas se aplica una, se guarda la elección y
  // el módulo desaparece para siempre de acá — reaparece solo bajo demanda,
  // detrás de "Cambiar plantilla", nunca como bloque permanente.
  const hasChosenTemplate = typeof household.settings.categoryTemplateChoice === "string";
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false);
  usePageHeader({ title: t("categoryTemplate.title"), onBack, backLabel: t("ds.appHeader.back") });

  // Red de seguridad contra categorías duplicadas (mismo nombre+tipo, dos
  // raíces activas) — corre una vez por entrada a la pantalla. Idempotente:
  // sin duplicados es un puñado de comparaciones en memoria, sin ninguna
  // escritura. El guard por `useRef` evita reintentarlo en cada
  // invalidación de query que la fusión misma dispara.
  const mergedOnceRef = useRef(false);
  useEffect(() => {
    if (mergedOnceRef.current) return;
    mergedOnceRef.current = true;
    void mergeDuplicateCategories(household.id).then(({ mergedCount }) => {
      if (mergedCount === 0) return;
      invalidateCategories();
      invalidateTransactions();
      toast(t("categoryTemplate.duplicatesMerged", { count: mergedCount }));
    });
  }, [household.id, invalidateCategories, invalidateTransactions, t]);

  const usedCategoryIds = useMemo(() => new Set(transactions.map((tx) => tx.categoryId).filter((id): id is string => id !== null)), [transactions]);
  /**
   * Índice de uso de TODAS las categorías, para saber cuáles se pueden
   * borrar. Vive en una query aparte porque lee seis tablas (transacciones,
   * repartos, presupuestos, recurrentes, reglas y comercios) — ver
   * `lib/categories/category-usage.ts`, que explica por qué "0 movimientos"
   * no alcanza como criterio.
   */
  const { data: usageIndex } = useQuery({
    queryKey: ["category-usage", household.id],
    queryFn: () => buildCategoryUsageIndex(household.id),
  });

  /**
   * Traduce el uso a la frase que ve el usuario, o `null` si no hay nada que
   * la referencie y por lo tanto se puede borrar. Mientras el índice carga
   * devuelve una frase vacía —no `null`— para que el botón nazca
   * deshabilitado: habilitarlo por un instante, antes de saber si hay
   * referencias, es exactamente el momento en que alguien lo aprieta.
   */
  const deleteBlockedReason = (category: CategoryRow | undefined): string | null => {
    if (!category) return "";
    if (!usageIndex) return "";
    // El criterio es el SUBÁRBOL, no la categoría sola: borrar arrastra a las
    // subcategorías, así que tener hijas no bloquea — bloquea que alguna de
    // ellas tenga algo asociado.
    const usage = subtreeUsage(usageIndex, category.id);
    if (isDeletable(usage)) return null;
    const parts = [
      usage.transactions > 0 ? t("categoryTemplate.usageTransactions", { count: usage.transactions }) : null,
      usage.splits > 0 ? t("categoryTemplate.usageSplits", { count: usage.splits }) : null,
      usage.budgets > 0 ? t("categoryTemplate.usageBudgets", { count: usage.budgets }) : null,
      usage.recurringRules > 0 ? t("categoryTemplate.usageRecurring", { count: usage.recurringRules }) : null,
      usage.categorizationRules > 0 ? t("categoryTemplate.usageRules", { count: usage.categorizationRules }) : null,
      usage.payees > 0 ? t("categoryTemplate.usagePayees", { count: usage.payees }) : null,
    ].filter((p): p is string => p !== null);
    return t("categoryTemplate.deleteBlocked", { reasons: parts.join(" · ") });
  };

  /** Cuántas subcategorías se van a borrar junto con ella, para avisarlo antes. */
  const deleteCascadeCount = (category: CategoryRow | undefined): number => {
    if (!category || !usageIndex) return 0;
    return collectSubtree(usageIndex, category.id).length - 1;
  };

  const handleDeleteCategory = (category: CategoryRow) => {
    if (!usageIndex) return;
    const label = categoryLabel(category);
    // Hoja a raíz: en ningún momento queda una hija colgando de una madre
    // que ya se borró.
    const ids = collectSubtree(usageIndex, category.id);
    const childCount = ids.length - 1;
    void categoriesRepo.removeMany(ids).then(() => {
      invalidateCategories();
      invalidateUsage();
    });
    toast(
      childCount > 0
        ? t("categoryTemplate.categoryDeletedWithChildren", { name: label, count: childCount })
        : t("categoryTemplate.categoryDeletedForGood", { name: label })
    );
  };

  const movementCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.categoryId) map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + 1);
    }
    return map;
  }, [transactions]);
  const countInKind = categories.filter((c) => c.kind === kind).length;
  // Las archivadas siguen al segmentado igual que el árbol: gastos y ingresos
  // no se mezclan en la misma vista.
  const archivedInKind = archivedCategories.filter((c) => c.kind === kind);

  const handleSaveCategory = async (target: CategorySheetTarget, values: { name: string; icon: IconName }) => {
    if (target.mode === "edit") {
      await categoriesRepo.update(target.category.id, values);
      invalidateCategories();
      return;
    }
    const effectiveKind = target.parent?.kind ?? target.kind;
    const dupe = findExistingCategoryByName(values.name, categories, effectiveKind, categoryLabel);
    if (dupe) {
      toast(t("categoryTemplate.alreadyExists", { name: categoryLabel(dupe) }));
      return;
    }
    const input = buildNewCategoryInput({
      householdId: household.id,
      name: values.name,
      kind: target.kind,
      createdBy: userId,
      existing: categories,
      parent: target.parent,
      icon: values.icon,
    });
    await categoriesRepo.create(input);
    invalidateCategories();
  };

  /**
   * Archiva en cascada (`archiveWithChildren`), nunca borra (CLAUDE.md §
   * "apagar oculta, nunca borra"). Reversible con un solo "Deshacer" que
   * restaura todo el subárbol — no hay diálogo de confirmación porque el
   * toast ES el camino de vuelta.
   */
  const handleArchiveCategory = (category: CategoryRow) => {
    const label = categoryLabel(category);
    const children = categories.filter((c) => c.parentId === category.id && c.archivedAt === null);
    const ids = [category.id, ...children.map((c) => c.id)];
    void categoriesRepo.archiveWithChildren(category.id).then(() => {
      invalidateCategories();
      invalidateUsage();
    });
    toast(children.length > 0 ? t("categoryTemplate.categoryArchivedWithChildren", { name: label, count: children.length }) : t("categoryTemplate.categoryArchived", { name: label }), {
      action: {
        label: t("common.undo"),
        onClick: () => {
          void categoriesRepo.restoreMany(ids).then(() => {
            invalidateCategories();
          });
        },
      },
    });
  };

  /**
   * Revive una categoría archivada desde la sección "Archivadas".
   *
   * Revive también sus ancestros archivados: restaurar una subcategoría sola,
   * con el padre todavía archivado, la dejaba colgando como si fuera raíz
   * (`CategoryTree` trata como raíz a cualquiera cuyo padre no esté en la
   * lista activa). Archivar un padre arrastra a sus hijos, así que lo
   * simétrico al restaurar es arrastrar a los padres.
   *
   * Sin "deshacer" en el toast a propósito: la acción inversa es archivar,
   * que está a un tap en el sheet de la categoría recién restaurada.
   */
  const handleRestoreCategory = (category: CategoryRow) => {
    const byId = new Map(archivedCategories.map((c) => [c.id, c]));
    const ids = [category.id];
    let parentId = category.parentId;
    while (parentId && byId.has(parentId)) {
      ids.push(parentId);
      parentId = byId.get(parentId)!.parentId;
    }
    void categoriesRepo.restoreMany(ids).then(() => {
      invalidateCategories();
      invalidateUsage();
    });
    toast(t("categoryTemplate.categoryRestored", { name: categoryLabel(category) }));
  };

  const handleSaveTemplate = async (templateChoice: CategoryTemplateChoice = choice) => {
    setSavingTemplate(true);
    await applyCategoryTemplate(household.id, templateChoice, userId, usedCategoryIds);
    await householdsRepo.update(household.id, { settings: { ...household.settings, categoryTemplateChoice: templateChoice } });
    invalidateCategories();
    invalidateHousehold();
    setSavingTemplate(false);
    setChangeTemplateOpen(false);
    toast(t("categoryTemplate.saved"));
  };

  /** Acción del estado vacío (K5): "empezaste de cero, usá la básica" — aplica directo, sin pasar por el selector de la derecha. */
  const handleUseBasicTemplate = async () => {
    setChoice("basic");
    await handleSaveTemplate("basic");
  };

  return (
    // `scroll-fade-bottom` (`globals.css`, ver `/more/page.tsx`): esta
    // pantalla maneja su propio scroller (sumada a `OWN_SCROLLER_ROUTES` en
    // `(app)/layout.tsx` — sin eso, el `<main>` compartido también intenta
    // scrollear, y el corte visible no cae en el borde real del viewport
    // sino en el borde más corto del scroller interno). `useScrollOverflow`
    // decide si hay contenido real para scrollear antes de mostrar el
    // degradado — si no, se ve un fundido apuntando a "hay más abajo"
    // cuando en realidad no hay nada más.
    <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } as CSSProperties}>
      {/* Todo en UN solo contenedor con scroll — antes el botón "Nueva
          categoría" era un hermano por fuera de este `overflowY: auto`, así
          que quedaba clavado abajo (ni scrolleaba con la lista ni era
          realmente el último ítem). Ahora es el último elemento de acá
          adentro: se lo lleva el scroll como cualquier otro contenido. */}
      <div
        ref={scrollerRef}
        // `pb-9` (36px) en mobile — 50% más que los 24px de antes, para que
        // el botón "Nueva categoría" no quede pegado contra la tab bar al
        // llegar al final del scroll. `lg:pb-6` vuelve a los 24px de
        // siempre en desktop (ahí no hay tab bar debajo, sobraba).
        className="pb-9 lg:pb-6 scroll-gutter-right"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* `lg`+: mientras el módulo de plantilla está visible (primera
            vez), el árbol va a la izquierda y la plantilla a la derecha —
            dos secciones de contenido real, no una sola estirada a los
            1200px del layout. Una vez aplicada, el módulo desaparece y el
            árbol pasa a ocupar el ancho completo en cualquier tamaño. */}
        <div className={hasChosenTemplate ? "grid grid-cols-1" : "grid grid-cols-1 lg:grid-cols-2"} style={{ gap: 24 }}>
          <div>
            {categories.length === 0 ? (
              <EmptyState message={t("categoryTemplate.listEmpty")} actionLabel={t("categoryTemplate.basicTitle")} onAction={() => void handleUseBasicTemplate()} />
            ) : (
              <>
                <SegmentedControl
                  options={[
                    { id: "expense", label: t("categoryTemplate.expensesTab") },
                    { id: "income", label: t("categoryTemplate.incomeTab") },
                  ]}
                  value={kind}
                  onChange={(id) => setKind(id as CategoryKind)}
                />
                <p className="t-caption" style={{ margin: "12px 0 4px", color: "var(--text-muted)" }}>
                  {t(kind === "expense" ? "categoryTemplate.countExpense" : "categoryTemplate.countIncome", { count: countInKind })}
                </p>
                <CategoryTree categories={categories} kind={kind} movementCounts={movementCounts} onEdit={(category) => setSheetTarget({ mode: "edit", category })} twoColumns={hasChosenTemplate} />
                {/* Crear cierra la lista, como última fila — mismo patrón que
                    `/more/tags` y `/more/rules`, las otras dos pantallas de
                    gestión, que ya resolvían "agregar" con una `ListRow` de
                    variante `action` en vez de un botón primario suelto.
                    Antes era un `<Button variant="primary">` al final del
                    scroller: en escritorio quedaba tan abajo que había que
                    scrollear la pantalla entera para llegar.

                    Mismo tope de ancho que "Cambiar plantilla" — sin él la
                    fila se estira por debajo de las dos columnas del masonry
                    de arriba. */}
                <div className="lg:max-w-[var(--content-max-width)]" style={{ marginTop: 8 }}>
                  <ListRow icon="plus" label={t("categoryTemplate.newCategory")} variant="action" onClick={() => setSheetTarget({ mode: "create", kind, parent: null })} />
                </div>
                <p className="t-caption" style={{ margin: "16px 0 0", color: "var(--text-muted)" }}>
                  {t("categoryTemplate.archiveNote")}
                </p>
                {/* Sin esta sección, archivar era irreversible en la práctica:
                    `restoreMany` solo estaba cableado al "Deshacer" del toast,
                    así que apenas ese toast se iba no quedaba ninguna pantalla
                    desde donde recuperar la categoría — justo lo contrario de
                    lo que promete la nota de acá arriba. Espeja la sección
                    "Archivadas" de `/accounts`: atenuadas, y un tap las
                    revive. */}
                {archivedInKind.length > 0 ? (
                  <div className="lg:max-w-[var(--content-max-width)]" style={{ marginTop: 20 }}>
                    <p className="t-label" style={{ margin: "0 0 4px", color: "var(--text-muted)" }}>
                      {t("categoryTemplate.archivedSection")}
                    </p>
                    <ArchivedCategoryTree
                      archived={archivedInKind}
                      activeById={new Map(categories.map((c) => [c.id, c]))}
                      onEdit={(category) => setSheetTarget({ mode: "edit", category })}
                    />
                  </div>
                ) : null}
                {hasChosenTemplate ? (
                  // Mismo tope que "Nueva categoría" — sin esto, esta fila
                  // (una sola columna dentro del `<div>` de la izquierda,
                  // que acá ocupa el ancho completo) se estira por debajo
                  // de las dos columnas del masonry de arriba.
                  <div className="lg:max-w-[var(--content-max-width)]" style={{ marginTop: 8 }}>
                    <ListRow icon="refresh" label={t("categoryTemplate.changeTemplate")} variant="navigation" onClick={() => setChangeTemplateOpen(true)} />
                  </div>
                ) : null}
              </>
            )}
          </div>
          {hasChosenTemplate ? null : (
            <div>
              <p className="t-label" style={{ margin: "0 0 4px", color: "var(--text-secondary)" }}>
                {t("categoryTemplate.templateSectionTitle")}
              </p>
              <TemplatePicker choice={choice} onChoice={setChoice} onApply={() => void handleSaveTemplate()} applying={savingTemplate} applyVariant="secondary" />
            </div>
          )}
        </div>
      </div>
      <CategorySheet
        key={sheetTarget?.mode === "edit" ? sheetTarget.category.id : sheetTarget?.mode === "create" ? `create-${sheetTarget.parent?.id ?? "root"}-${sheetTarget.kind}` : "none"}
        target={sheetTarget}
        onClose={() => setSheetTarget(null)}
        onSave={handleSaveCategory}
        onArchive={handleArchiveCategory}
        onRestore={handleRestoreCategory}
        onDelete={handleDeleteCategory}
        deleteBlockedReason={deleteBlockedReason(sheetTarget?.mode === "edit" ? sheetTarget.category : undefined)}
        deleteCascadeCount={deleteCascadeCount(sheetTarget?.mode === "edit" ? sheetTarget.category : undefined)}
        onAddSubcategory={(parent) => setSheetTarget({ mode: "create", kind: parent.kind, parent })}
      />
      {/* Único lugar donde el módulo de 3 opciones reaparece después de la
          primera vez — bajo demanda, nunca como bloque permanente. */}
      <Sheet open={changeTemplateOpen} title={t("categoryTemplate.changeTemplateTitle")} onClose={() => setChangeTemplateOpen(false)} height="auto" style={{ maxWidth: "var(--content-max-width)" }}>
        <TemplatePicker choice={choice} onChoice={setChoice} onApply={() => void handleSaveTemplate()} applying={savingTemplate} applyVariant="primary" />
      </Sheet>
    </div>
  );
}
