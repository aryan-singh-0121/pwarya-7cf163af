/** Central audit trail writer. Never throws — logging must not break a flow. */
export async function writeAudit(entry: {
  actor?: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  email?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor: entry.actor ?? "system",
      action: entry.action,
      target_type: entry.targetType ?? "",
      target_id: entry.targetId ?? null,
      email: entry.email ?? null,
      details: (entry.details ?? {}) as never,
    });
  } catch {
    /* ignore */
  }
}
