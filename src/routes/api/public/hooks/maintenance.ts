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

        if (expired?.length) {
          const ids = expired.map((s) => s.user_id);
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("status", "active")
            .lte("expires_at", nowIso);
          await supabaseAdmin
            .from("device_sessions")
            .update({ is_active: false })
            .in("user_id", ids);
        }

        return Response.json({
          ok: true,
          purgedScreenshots: paths.length,
          expiredSubscriptions: expired?.length ?? 0,
        });
      },
    },
  },
});
