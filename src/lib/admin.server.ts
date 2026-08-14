import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";

export type AdminSession = { admin?: boolean; user?: string };

export function adminSessionConfig() {
  const password = process.env["ADMIN_SESSION_SECRET"];
  if (!password) throw new Error("ADMIN_SESSION_SECRET is not set");
  return {
    password,
    name: "pwarya-admin",
    maxAge: 60 * 60 * 12,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export async function requireAdmin() {
  const session = await useSession<AdminSession>(adminSessionConfig());
  if (!session.data.admin) throw new Error("Not authorized");
  return session;
}

export function generateAccessKey() {
  const body = randomBytes(4).toString("hex").toUpperCase();
  const suffix = String(Math.floor(Math.random() * 90) + 10);
  return `PWARYA-${body}-${suffix}`;
}

export async function verifyTurnstile(token: string | undefined, ip?: string) {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  // Not configured yet -> skip verification instead of blocking users.
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
