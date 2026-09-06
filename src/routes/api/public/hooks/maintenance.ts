import { createFileRoute } from "@tanstack/react-router";

/**
 * Housekeeping: deletes payment screenshots 10 minutes after a decision and
 * expires subscriptions whose time is over (also removes their device locks).
 */
export const Route = createFileRoute("/api/public/hooks/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only shared secret; never shipped to the browser.
        const key =
          request.headers.get("x-maintenance-secret") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env["MAINTENANCE_SECRET"];
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        const { data: due } = await supabaseAdmin
          .from("payment_requests")
          .select("id, screenshot_path")
          .not("purge_at", "is", null)
          .lte("purge_at", nowIso)
          .not("screenshot_path", "is", null);

        const paths = (due ?? []).map((r) => r.screenshot_path).filter(Boolean) as string[];
        if (paths.length) {
          await supabaseAdmin.storage.from("payment-proofs").remove(paths);
          await supabaseAdmin
            .from("payment_requests")
            .update({ screenshot_path: null, purge_at: null })
            .in(
              "id",
              (due ?? []).map((r) => r.id),
            );
        }

        const { data: expired } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("status", "active")
          .not("expires_at", "is", null)
          .lte("expires_at", nowIso);

        let removedAccounts = 0;
        if (expired?.length) {
          const ids = [...new Set(expired.map((s) => s.user_id))];
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("status", "active")
            .lte("expires_at", nowIso);

          const { writeAudit } = await import("@/lib/audit.server");
          for (const id of ids) {
            // The plan is over: the whole account is removed automatically.
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("email")
              .eq("id", id)
              .maybeSingle();
            await supabaseAdmin.from("device_sessions").delete().eq("user_id", id);
            await supabaseAdmin.from("notifications").delete().eq("user_id", id);
            await supabaseAdmin.from("feedback").delete().eq("user_id", id);
            await supabaseAdmin.from("subscriptions").delete().eq("user_id", id);
            await supabaseAdmin.from("profiles").delete().eq("id", id);
            const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
            if (!error) removedAccounts += 1;
            await writeAudit({
              action: "account_auto_removed_on_expiry",
              targetType: "user",
              targetId: id,
              email: prof?.email ?? null,
            });
          }
        }

        // Motivational / encouragement push every ~2-3 days for active members.
        const MOTIVATION = [
          "Every hour you study today buys you an easier tomorrow. Keep going!",
          "Small daily progress beats one big cram session. Open a lecture now!",
          "You are closer than you think. One chapter today, one step ahead.",
          "Consistency wins ranks. Finish one topic before you sleep tonight.",
          "Toppers are just students who did not stop. Stay in the game!",
        ];
        const cutoff = new Date(Date.now() - 2.5 * 86400000).toISOString();
        const { data: activeSubs } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("status", "active")
          .limit(1000);
        const activeIds = [...new Set((activeSubs ?? []).map((s) => s.user_id))];
        let motivated = 0;
        if (activeIds.length) {
          const { data: dueProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, last_motivation_at, full_name")
            .in("id", activeIds);
          for (const p of dueProfiles ?? []) {
            if (p.last_motivation_at && p.last_motivation_at > cutoff) continue;
            const body = MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)]!;
            await supabaseAdmin.from("notifications").insert({
              user_id: p.id,
              kind: "motivation",
              title: "Keep going 🚀",
              body: p.full_name ? `${p.full_name.split(" ")[0]}, ${body}` : body,
            });
            await supabaseAdmin
              .from("profiles")
              .update({ last_motivation_at: nowIso })
              .eq("id", p.id);
            motivated += 1;
          }
        }

        return Response.json({
          ok: true,
          purgedScreenshots: paths.length,
          expiredSubscriptions: expired?.length ?? 0,
          removedAccounts,
          motivationSent: motivated,
        });
      },
    },
  },
});
