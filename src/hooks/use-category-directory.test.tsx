// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { categoriesRepo, type NewCategoryInput } from "@/lib/repos/categories-repo";
import { useCategoryDirectory } from "./use-category-directory";

const HOUSEHOLD = "hh-1";
const USER = "user-1";

const messages = {
  transactions: { detail: { noCategory: "Sin categoría" } },
  reference: { category: { groceries: "Supermercado" } },
};

function newCategory(overrides: Partial<NewCategoryInput> = {}): NewCategoryInput {
  return {
    householdId: HOUSEHOLD,
    parentId: null,
    name: "Electrónica",
    i18nKey: null,
    icon: "cart",
    color: "var(--data-1)",
    kind: "expense",
    nature: "variable",
    isSystem: false,
    sortOrder: 0,
    visibility: "household",
    ownerId: null,
    createdBy: USER,
    ...overrides,
  };
}

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useCategoryDirectory(HOUSEHOLD), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="es" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    ),
  });
}

describe("useCategoryDirectory", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-category-directory-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("resuelve el nombre de una categoría activa", async () => {
    const [created] = await categoriesRepo.bulkCreate([newCategory()]);
    const { result } = render();
    await waitFor(() => expect(result.current(created!.id)).toBe("Electrónica"));
  });

  it("sigue resolviendo el nombre de una categoría archivada — no cae al UUID", async () => {
    const [created] = await categoriesRepo.bulkCreate([newCategory({ name: "Viajes", icon: "airplane" })]);
    await categoriesRepo.archive(created!.id);

    const { result } = render();
    await waitFor(() => expect(result.current(created!.id)).toBe("Viajes"));
    // Confirma la premisa del bug: `list()` (no usada acá) ya no vería esta fila.
    expect(await categoriesRepo.list(HOUSEHOLD)).toEqual([]);
  });

  it("sigue resolviendo el nombre de una categoría borrada (soft delete)", async () => {
    const [created] = await categoriesRepo.bulkCreate([newCategory({ name: "Regalos", icon: "gift" })]);
    await categoriesRepo.remove(created!.id);

    const { result } = render();
    await waitFor(() => expect(result.current(created!.id)).toBe("Regalos"));
  });

  it("una categoría de sistema con i18nKey se traduce", async () => {
    const [created] = await categoriesRepo.bulkCreate([newCategory({ name: "Groceries", i18nKey: "groceries", isSystem: true })]);

    const { result } = render();
    await waitFor(() => expect(result.current(created!.id)).toBe("Supermercado"));
  });

  it("un id inexistente (huérfano) devuelve 'Sin categoría', nunca el id", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current("00000000-0000-4000-8000-000000000000")).toBe("Sin categoría"));
  });

  it("null y undefined devuelven 'Sin categoría'", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current(null)).toBe("Sin categoría"));
    expect(result.current(undefined)).toBe("Sin categoría");
  });
});
