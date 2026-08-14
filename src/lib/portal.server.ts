import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env["ADMIN_SESSION_SECRET"];
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

export function signPortalToken(userId: string, ttlMs = 1000 * 60 * 60 * 6) {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

export function verifyPortalToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [userId, exp, sig] = raw.split(".");
    if (!userId || !exp || !sig) return null;
    const expected = createHmac("sha256", secret())
      .update(`${userId}.${exp}`)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Number(exp) < Date.now()) return null;
    return userId;
  } catch {
    return null;
  }
}
