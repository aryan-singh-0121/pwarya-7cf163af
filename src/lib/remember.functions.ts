import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const COOKIE = "pwarya_rt";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

async function cookieApi() {
  return import("@tanstack/react-start/server");
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

/** Stores the member's refresh token in an httpOnly device cookie. */
export const rememberDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ refreshToken: z.string().min(10).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { setCookie } = await cookieApi();
    setCookie(COOKIE, data.refreshToken, cookieOpts());
    return { ok: true };
  });

/** Uses the device cookie to mint a fresh session, so members skip the login form. */
export const restoreRememberedSession = createServerFn({ method: "POST" }).handler(async () => {
  const { getCookie, setCookie, deleteCookie } = await cookieApi();
  const token = getCookie(COOKIE);
  if (!token) return { ok: false as const };

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { ok: false as const };

  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
  });
  if (!res.ok) {
    deleteCookie(COOKIE, { path: "/" });
    return { ok: false as const };
  }
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token || !json.refresh_token) {
    deleteCookie(COOKIE, { path: "/" });
    return { ok: false as const };
  }
  setCookie(COOKIE, json.refresh_token, cookieOpts());
  return { ok: true as const, accessToken: json.access_token, refreshToken: json.refresh_token };
});

/** Removes the device cookie (logout / signed out elsewhere). */
export const forgetDevice = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await cookieApi();
  deleteCookie(COOKIE, { path: "/" });
  return { ok: true };
});
