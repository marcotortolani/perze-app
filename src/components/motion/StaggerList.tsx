"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { spring, stagger } from "@/lib/motion/springs";
import { useMotionIntensity } from "./use-motion-intensity";

export interface StaggerListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  className?: string | undefined;
}

/** Entrada de lista con stagger de 24ms, `y: 12 → 0`, `opacity: 0 → 1` — solo los primeros 8 items. */
export function StaggerList<T>({ items, renderItem, getKey, className }: StaggerListProps<T>) {
  const intensity = useMotionIntensity();
  const animated = intensity === "full";

  return (
    <div className={className}>
      {items.map((item, i) => {
        const delay = animated && i < stagger.listMaxItems ? i * stagger.list : 0;
        return (
          <motion.div
            key={getKey(item, i)}
            initial={animated ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.default, delay }}
          >
            {renderItem(item, i)}
          </motion.div>
        );
      })}
    </div>
  );
}
