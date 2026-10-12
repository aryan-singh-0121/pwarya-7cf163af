import { supabase } from "@/integrations/supabase/client";
import { restoreRememberedSession } from "@/lib/remember.functions";

/** Returns true when a session exists, restoring it from the device cookie if needed. */
export async function ensureSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  try {
    const r = await restoreRememberedSession();
    if (!r.ok) return false;
    const { error } = await supabase.auth.setSession({
      access_token: r.accessToken,
      refresh_token: r.refreshToken,
    });
    return !error;
  } catch {
    return false;
  }
}
