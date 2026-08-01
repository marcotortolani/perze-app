"use client";

import { useQuery } from "@tanstack/react-query";
import { priceIndexRepo } from "@/lib/repos/price-index-repo";

export function usePriceIndex(currencyCode: string | undefined) {
  return useQuery({
    queryKey: ["price-index", currencyCode ?? ""],
    queryFn: () => priceIndexRepo.list(currencyCode!),
    enabled: !!currencyCode,
  });
}
