import { SkeletonRow } from "@/design-system";

// Mismo fallback que `BudgetsPageContent` ya usa detrás de su `dynamic()`
// (module-gated, código diferido) — ver `budgets/page.tsx`.
export default function Loading() {
  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
