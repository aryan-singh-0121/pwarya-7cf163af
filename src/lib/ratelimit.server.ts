/**
 * Small in-memory sliding-window limiter for the edge runtime.
 * Used to slow brute-force login attempts and portal/reader abuse.
 */
type Bucket = { hits: number[]; blockedUntil: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { limit, windowMs, blockMs = windowMs }: { limit: number; windowMs: number; blockMs?: number },
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [], blockedUntil: 0 };

  if (b.blockedUntil > now) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }

  b.hits = b.hits.filter((t) => now - t < windowMs);
  b.hits.push(now);

  if (b.hits.length > limit) {
    b.blockedUntil = now + blockMs;
    b.hits = [];
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil(blockMs / 1000) };
  }

  buckets.set(key, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.blockedUntil < now && v.hits.length === 0) buckets.delete(k);
    }
  }
  return { ok: true, retryAfter: 0 };
}

export function clientKey(request: Request, scope: string) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `${scope}:${ip}`;
}
