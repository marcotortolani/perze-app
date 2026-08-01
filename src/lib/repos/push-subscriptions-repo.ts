import { createClient } from "../supabase/client";
import { newId } from "./ids";

/**
 * K12 — credencial de push por dispositivo/navegador. RLS restringe a la
 * fila propia (`profile_id = auth.uid()`) — ni siquiera un admin del
 * household ve las suscripciones de otro miembro.
 */
export const pushSubscriptionsRepo = {
  async save(profileId: string, subscription: PushSubscription): Promise<void> {
    const supabase = createClient();
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Suscripción de push incompleta");
    const row = { id: newId(), profile_id: profileId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth };
    const { error } = await supabase.from("push_subscriptions").upsert(row as never, { onConflict: "endpoint" });
    if (error) throw error;
  },

  async remove(endpoint: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
  },
};
