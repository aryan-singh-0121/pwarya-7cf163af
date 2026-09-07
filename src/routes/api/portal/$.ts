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
          .from("app_content_config")
          .select("content_url, content_headers, content_proxy_url")
          .eq("id", 1)
          .maybeSingle();
        const base = settings?.content_url || "https://pwthor.live/study/batches";
        // Optional relay (admin-configured) used when the content host blocks our
        // datacentre address outright. Example: https://relay.example.com/?url=
        const relay = (settings?.content_proxy_url ?? "").trim();
        // Optional extra request headers (JSON) — used to allowlist us on the
        // content host's firewall, e.g. {"x-pw-bypass":"secret"}.
        let extraHeaders: Record<string, string> = {};
        try {
          const parsed = JSON.parse((settings?.content_headers ?? "").trim() || "{}");
          if (parsed && typeof parsed === "object") {
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
              if (typeof v === "string" && v.length < 500) extraHeaders[k.toLowerCase()] = v;
            }
          }
        } catch {
          extraHeaders = {};
        }
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

        const attemptNo = Number(url.searchParams.get("pwr") ?? "0") || 0;

        // Rotate through a few realistic browser fingerprints, then (if the admin
        // configured one) a relay address, until something comes back unblocked.
        const profiles = [
          {
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            chUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            mobile: "?0",
            platform: '"Windows"',
          },
          {
            ua: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
            chUa: '"Chromium";v="127", "Not)A;Brand";v="99", "Google Chrome";v="127"',
            mobile: "?1",
            platform: '"Android"',
          },
          {
            ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
            chUa: "",
            mobile: "?0",
            platform: '"macOS"',
          },
        ];
        const prof = profiles[attemptNo % profiles.length]!;

        const fwd: Record<string, string> = {
          "user-agent": prof.ua,
          accept:
            request.headers.get("accept") ??
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,hi;q=0.8",
          "cache-control": "no-cache",
          pragma: "no-cache",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": attemptNo > 0 ? "same-origin" : "none",
          "sec-fetch-user": "?1",
          "upgrade-insecure-requests": "1",
          referer: baseUrl.origin + "/",
          ...extraHeaders,
        };
        if (prof.chUa) {
          fwd["sec-ch-ua"] = prof.chUa;
          fwd["sec-ch-ua-mobile"] = prof.mobile;
          fwd["sec-ch-ua-platform"] = prof.platform;
        }
        // Deliberately NOT forwarding the visitor's Cookie header: it would send
        // our own site cookies (including the admin session) to a third-party host.

        const candidates = [target.toString()];
        if (relay) {
          candidates.push(
            relay.includes("{url}")
              ? relay.replace("{url}", encodeURIComponent(target.toString()))
              : relay.endsWith("=")
                ? relay + encodeURIComponent(target.toString())
                : relay.replace(/\/+$/, "") + "/" + target.toString(),
          );
        }

        let upstream: Response | null = null;
        for (const candidate of candidates) {
          try {
            const res = await fetch(candidate, { headers: fwd, redirect: "follow" });
            upstream = res;
            if (res.ok) break;
          } catch {
            /* try the next candidate */
          }
        }
        if (!upstream) {
          return new Response("Content is temporarily unreachable.", { status: 502 });
        }

        const headers = new Headers();
        upstream.headers.forEach((value, key) => {
          if (!STRIP.has(key.toLowerCase())) headers.set(key, value);
        });
        headers.set("cache-control", "no-store");
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
          // we show our own branded retry screen that re-requests through the proxy.
          const challenged =
            upstream.headers.has("cf-mitigated") ||
            ((upstream.status === 403 || upstream.status === 429 || upstream.status === 503) &&
              /just a moment|cf-browser-verification|challenge-platform|attention required|you have been blocked|cf-error-details/i.test(
                html,
              ));
          if (challenged) {
            const attempt = attemptNo;
            headers.set("x-portal-blocked", "1");
            headers.set("content-type", "text/html; charset=utf-8");
            const retryHref = `${PREFIX}${splat.replace(/^\/+/, "")}?pwr=${attempt + 1}`;
            return new Response(
              `<!doctype html><meta charset="utf-8"><title>PW ARYA · Study</title><body style="margin:0;background:#0b1020;color:#e8ecf7;font-family:system-ui"><div style="display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;height:100vh;text-align:center;padding:0 24px"><p style="opacity:.85">Preparing your batches…</p><p style="font-size:12px;opacity:.6">Secure check in progress.</p></div><script>(function(){var a=${attempt};if(a<3){setTimeout(function(){location.href=${JSON.stringify(retryHref)}},1500*(a+1));return;}try{parent.postMessage({type:'pw-portal-fallback'},'*')}catch(e){}})();</script></body>`,
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
