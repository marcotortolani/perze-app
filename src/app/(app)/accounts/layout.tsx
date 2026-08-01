"use client";

import type { ReactNode } from "react";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

/** E1/E2 en dos columnas de escritorio — mismo patrón que `transactions/layout.tsx`, ver esa nota. */
export default function AccountsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);

  if (!isSplit) return <>{children}{detail}</>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,420px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      <div style={{ minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", borderLeft: "1px solid var(--border)", paddingLeft: 32 }}>{detail}</div>
    </div>
  );
}
