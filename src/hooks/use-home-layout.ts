"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { profileHomeLayoutRepo } from "@/lib/repos/profile-home-layout-repo";
import { createOptimisticMutation } from "@/lib/offline/create-optimistic-mutation";
import { useHomeLayoutMirrorStore } from "@/stores/home-layout-mirror-store";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import type { StoredHomeLayoutDoc } from "@/features/home/layout/types";

export function homeLayoutKey(profileId: string) {
  return ["profile-home-layout", profileId] as const;
}

/**
 * Orden del home, por perfil. Excepción declarada al outbox de Dexie
 * (CLAUDE.md pide que toda mutación pase por ahí): esto es una preferencia
 * de UI, no una entidad del household con historia de conflicto — el
 * outbox existe para lo que "nunca se puede perder"; last-write-wins es la
 * semántica correcta para "en qué orden quiero ver mis bloques", y perder
 * un reorden hecho offline no es pérdida de datos. Mismo criterio que
 * `profileNotificationPreferencesRepo`/`profilesRepo.updateIcon` — escriben
 * directo a Supabase, sin encolar. El espejo local (`home-layout-mirror-store.ts`)
 * cubre el resto: primer pintado sin salto y que el modo demo (sin sesión
 * real, el `update` falla por RLS) siga funcionando en el dispositivo.
 */
export function useHomeLayout() {
  const t = useTranslations();
  const userId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const mirrorDoc = useHomeLayoutMirrorStore((s) => s.doc);
  const setMirrorDoc = useHomeLayoutMirrorStore((s) => s.setDoc);
  const queryKey = homeLayoutKey(userId ?? "");
  // Solo la PRIMERA vez que este hook confirma el doc del servidor pisa el
  // espejo — no en cada refetch. `onSettled` de `createOptimisticMutation`
  // invalida la query después de CUALQUIER mutación, éxito o error: sin
  // este guard, el refetch que sigue a un guardado que falló volvería a
  // traer el doc VIEJO del servidor y pisaría el cambio que `mutationFn`
  // acaba de aplicar al espejo — justo lo que el espejo existe para
  // evitar. Una hidratación por montaje alcanza para el propósito real
  // (primer pintado entre sesiones/dispositivos); no hace falta perseguir
  // cada refetch en vivo.
  const hasHydratedMirrorRef = useRef(false);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await profileHomeLayoutRepo.get(userId!);
      if (!hasHydratedMirrorRef.current) {
        hasHydratedMirrorRef.current = true;
        setMirrorDoc(result);
      }
      return result;
    },
    enabled: !!userId,
    // `initialData` pinta instantáneo con lo que ya había en este
    // dispositivo, pero `initialDataUpdatedAt: 0` lo marca "viejísimo" a
    // propósito — si no, TanStack Query lo trata como recién resuelto y
    // nunca dispara el fetch real al servidor mientras dure `staleTime`,
    // y el layout guardado en OTRO dispositivo jamás llegaría a pintarse.
    initialData: mirrorDoc,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation(
    createOptimisticMutation<StoredHomeLayoutDoc, void, StoredHomeLayoutDoc>({
      queryClient,
      queryKey,
      mutationFn: async (next) => {
        // Aplica local YA, incluso si el write remoto falla o no hay
        // `userId` (modo demo): la persona sigue viendo su orden en este
        // dispositivo aunque no se haya podido sincronizar.
        setMirrorDoc(next);
        if (!userId) return;
        if (next === null) await profileHomeLayoutRepo.reset(userId);
        else await profileHomeLayoutRepo.save(userId, next);
      },
      optimisticUpdate: (_previous, next) => next,
    })
  );

  return {
    doc: query.data ?? null,
    isPending: mutation.isPending,
    save: (next: StoredHomeLayoutDoc) => {
      mutation.mutate(next, { onError: () => toast(t("home.customize.saveFailed")) });
    },
  };
}
