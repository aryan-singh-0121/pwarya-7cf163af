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
  // Never let the external content host write cookies onto our own origin.
  "set-cookie",
  "set-cookie2",
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
        // Only ever join relative path segments to the configured content host.
        // Anything that parses as an absolute URL (or escapes the origin) is rejected (SSRF guard).
        if (/^[a-z][a-z0-9+.-]*:/i.test(splat) || splat.startsWith("//")) {
          return new Response("Invalid content path.", { status: 400 });
        }
        const target = splat
          ? new URL(splat.replace(/^\/+/, ""), baseUrl.origin + "/")
          : new URL(baseUrl.toString());
        if (target.origin !== baseUrl.origin) {
          return new Response("Invalid content path.", { status: 400 });
        }
        url.searchParams.delete("t");
        url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

        let upstream: Response;
        try {
          const ua =
            request.headers.get("user-agent") ??
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
          // Mirror a real Chrome request as closely as the edge runtime allows.
          const fwd: Record<string, string> = {
            "user-agent": ua,
            accept:
              request.headers.get("accept") ??
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9,hi;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "sec-ch-ua": '"Chromium";v="126", "Not:A-Brand";v="24", "Google Chrome";v="126"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            referer: baseUrl.origin + "/",
          };
          // Deliberately NOT forwarding the visitor's Cookie header: it would send
          // our own site cookies (including the admin session) to a third-party host.



          upstream = await fetch(target.toString(), { headers: fwd, redirect: "follow" });
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

          // Upstream bot-protection challenge: tell the client to launch directly.
          const challenged =
            upstream.headers.has("cf-mitigated") ||
            ((upstream.status === 403 || upstream.status === 503) &&
              /just a moment|cf-browser-verification|challenge-platform|attention required/i.test(
                html,
              ));
          if (challenged) {
            headers.set("x-portal-blocked", "1");
            headers.set("content-type", "text/html; charset=utf-8");
            return new Response(
              `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b1020;color:#e8ecf7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><p style="font-size:18px">Secure reader is warming up.</p><p style="opacity:.7">Use the <b>Open batches</b> button to launch your content.</p></div></body>`,
              { status: 200, headers },
            );
          }

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
