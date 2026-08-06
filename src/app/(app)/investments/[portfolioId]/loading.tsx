import { Skeleton } from "@/design-system";

// Mismo fallback que `OverviewContent` ya usa detrás de su `dynamic()` (module-gated, código diferido) — ver `[portfolioId]/page.tsx`.
export default function Loading() {
  return <Skeleton height={280} style={{ marginTop: 16 }} />;
}
