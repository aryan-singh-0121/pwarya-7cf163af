import { createFileRoute } from "@tanstack/react-router";
import { verifyPortalToken } from "@/lib/portal.server";
import { clientKey, rateLimit } from "@/lib/ratelimit.server";

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

const PORTAL_COOKIE = "pw_portal";
const PREFIX = "/api/portal/";

function readPortalCookie(request: Request): string {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === PORTAL_COOKIE) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** Rewrites every upstream address in the markup back onto our own origin. */
function maskHtml(html: string, origin: string) {
  const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = html
    // https://host/path  and  //host/path  → /api/portal/path
    .replace(new RegExp(escapedOrigin + "/?", "g"), PREFIX)
    .replace(new RegExp("//" + escapedOrigin.replace(/^https?:\/\//, "") + "/?", "g"), PREFIX);

  const baseTag = `<base href="${PREFIX}">`;
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  else out = baseTag + out;

  // Keep every in-page navigation inside our frame and strip frame-busting.
  out += `<script>(function(){try{
    var A=HTMLAnchorElement.prototype;
    document.addEventListener('click',function(e){
      var a=e.target&&e.target.closest?e.target.closest('a'):null;
      if(a&&a.target&&a.target!=='_self'){a.target='_self';}
    },true);
    Object.defineProperty(window,'top',{get:function(){return window}});
  }catch(_){}})();</script>`;
  return out;
}

/**
 * Masked reader: streams the members-only content through our own origin so the
 * upstream address is never shown in the address bar. Sub-requests (assets, page
 * links, XHR) come back through this same route via the rewritten <base> tag and
 * a short-lived HttpOnly cookie, so nothing ever hits the upstream host directly.
 */
export const Route = createFileRoute("/api/portal/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const limited = rateLimit(clientKey(request, "portal"), {
          limit: 240,
          windowMs: 60_000,
          blockMs: 60_000,
        });
        if (!limited.ok) {
          return new Response("Too many requests. Please wait a moment.", {
            status: 429,
            headers: { "retry-after": String(limited.retryAfter) },
          });
        }
        const url = new URL(request.url);
        const queryToken = url.searchParams.get("t") ?? "";
        const token = queryToken || readPortalCookie(request);
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
          if ((Number(url.searchParams.get("pwr") ?? "0") || 0) > 0) {
            fwd["sec-fetch-site"] = "same-origin";
          }
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
        headers.set("referrer-policy", "no-referrer");
        headers.set("x-content-type-options", "nosniff");
        // The reader is only ever embedded by PW ARYA itself, and it must never
        // be able to break out of the frame or reach our own document.
        headers.set("content-security-policy", "frame-ancestors 'self'; form-action *;");
        if (queryToken) {
          headers.append(
            "set-cookie",
            `${PORTAL_COOKIE}=${encodeURIComponent(queryToken)}; Path=${PREFIX}; Max-Age=21600; HttpOnly; Secure; SameSite=None`,
          );
        }

        const type = upstream.headers.get("content-type") ?? "";
        if (type.includes("text/html")) {
          const html = await upstream.text();

          // Upstream bot-protection challenge: we must NOT hand the address to the
          // browser (that would reveal the link and get refused in a frame). Instead
          // we show our own branded screen, retry silently a couple of times, and
          // only then ask the parent to launch through the signed /open redirect.
          const challenged =
            upstream.headers.has("cf-mitigated") ||
            ((upstream.status === 403 || upstream.status === 503) &&
              /just a moment|cf-browser-verification|challenge-platform|attention required/i.test(
                html,
              ));
          if (challenged) {
            const attempt = Number(url.searchParams.get("pwr") ?? "0") || 0;
            headers.set("x-portal-blocked", "1");
            headers.set("content-type", "text/html; charset=utf-8");
            const retryHref = `${PREFIX}${splat.replace(/^\/+/, "")}?pwr=${attempt + 1}`;
            return new Response(
              `<!doctype html><meta charset="utf-8"><title>PW ARYA · Study</title><body style="margin:0;background:#05070f;color:#e8ecf7;font-family:system-ui"><div style="display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;height:100vh;text-align:center;padding:0 24px"><p style="letter-spacing:.18em;font-weight:700;color:#7dd3fc">PW ARYA</p><p style="opacity:.85">Preparing your batches…</p></div><script>(function(){var a=${attempt};if(a<2){setTimeout(function(){location.href=${JSON.stringify(retryHref)}},900*(a+1));return;}try{parent.postMessage({type:'pw-portal-open'},'*')}catch(e){}})();</script></body>`,
              { status: 200, headers },
            );
          }



          return new Response(maskHtml(html, baseUrl.origin), { status: upstream.status, headers });
        }

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
