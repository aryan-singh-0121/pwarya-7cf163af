import { createFileRoute } from "@tanstack/react-router";
import { verifyPortalToken } from "@/lib/portal.server";

const STRIP = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "strict-transport-security",
]);

/**
 * Masked reader: streams the members-only content through our own origin so the
 * upstream address is never shown in the address bar.
 */
export const Route = createFileRoute("/api/portal/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t") ?? "";
        if (!verifyPortalToken(token)) {
          return new Response("Access expired. Please reload your dashboard.", {
            status: 401,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("content_url")
          .eq("id", 1)
          .maybeSingle();
        const base = settings?.content_url || "https://pwthor.live/study/batches";
        const baseUrl = new URL(base);

        const splat = (params as { _splat?: string })._splat ?? "";
        const target = splat
          ? new URL(splat, baseUrl.origin + "/")
          : new URL(baseUrl.toString());
        url.searchParams.delete("t");
        url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

        let upstream: Response;
        try {
          upstream = await fetch(target.toString(), {
            headers: {
              "user-agent": request.headers.get("user-agent") ?? "Mozilla/5.0",
              accept: request.headers.get("accept") ?? "*/*",
              "accept-language": "en-US,en;q=0.9",
              referer: baseUrl.origin + "/",
            },
            redirect: "follow",
          });
        } catch {
          return new Response("Content is temporarily unreachable.", { status: 502 });
        }

        const headers = new Headers();
        upstream.headers.forEach((value, key) => {
          if (!STRIP.has(key.toLowerCase())) headers.set(key, value);
        });
        headers.set("cache-control", "no-store");

        const type = upstream.headers.get("content-type") ?? "";
        if (type.includes("text/html")) {
          let html = await upstream.text();
          const baseTag = `<base href="${baseUrl.origin}/">`;
          html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
          if (!html.includes("<base")) html = baseTag + html;
          return new Response(html, { status: upstream.status, headers });
        }

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
