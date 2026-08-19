import { createFileRoute } from "@tanstack/react-router";
import { verifyPortalToken } from "@/lib/portal.server";
import { clientKey, rateLimit } from "@/lib/ratelimit.server";

/**
 * Last-resort launcher. When the upstream bot check refuses our proxied fetch,
 * the reader hands over to this route: it verifies the member's short-lived
 * token server-side and issues a redirect. The destination never appears in our
 * markup or in any link the member can inspect before the jump.
 */
export const Route = createFileRoute("/api/portal/open")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = rateLimit(clientKey(request, "portal-open"), {
          limit: 20,
          windowMs: 60_000,
          blockMs: 120_000,
        });
        if (!limited.ok) {
          return new Response("Too many requests. Please wait a moment.", {
            status: 429,
            headers: { "retry-after": String(limited.retryAfter) },
          });
        }

        const url = new URL(request.url);
        const token = url.searchParams.get("t") ?? "";
        if (!verifyPortalToken(token)) {
          return new Response("Access expired. Please reload your dashboard.", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("content_url")
          .eq("id", 1)
          .maybeSingle();
        const target = settings?.content_url || "https://pwthor.live/study/batches";

        return new Response(null, {
          status: 302,
          headers: {
            location: target,
            "referrer-policy": "no-referrer",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
