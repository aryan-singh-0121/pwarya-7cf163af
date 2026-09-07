import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deviceSchema = z.object({
  deviceId: z.string().trim().min(8).max(100),
  userAgent: z.string().max(400).optional(),
});

type AccessResult = {
  allowed: boolean;
  reason?: string;
  expiresAt?: string | null;
  planCode?: string | null;
};

async function evaluateAccess(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { allowed: false, reason: "Account not found." } as AccessResult;
  if (profile.status === "suspended")
    return { allowed: false, reason: "Your account is suspended. Contact support." } as AccessResult;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_code, expires_at, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return { allowed: false, reason: "No active subscription." } as AccessResult;
  if (sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "active");
    return { allowed: false, reason: "Your subscription has expired." } as AccessResult;
  }
  return {
    allowed: true,
    expiresAt: sub.expires_at,
    planCode: sub.plan_code,
  } as AccessResult;
}

/** Called right after sign-in: binds the account to one device and flags abuse. */
export const startDeviceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deviceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const email = (context.claims as { email?: string })?.email ?? "";

    const { data: active } = await supabaseAdmin
      .from("device_sessions")
      .select("device_id, last_seen")
      .eq("user_id", userId)
      .eq("is_active", true);

    const other = (active ?? []).find((d) => d.device_id !== data.deviceId);

    await supabaseAdmin.from("login_events").insert({
      user_id: userId,
      email,
      device_id: data.deviceId,
      ip,
      user_agent: data.userAgent ?? null,
      outcome: other ? "blocked_other_device" : "success",
    });

    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("login_events")
      .select("device_id")
      .eq("user_id", userId)
      .gte("created_at", since);
    const distinct = new Set((recent ?? []).map((r) => r.device_id).filter(Boolean));

    if (distinct.size >= 2) {
      const { data: openAlert } = await supabaseAdmin
        .from("security_alerts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "open")
        .maybeSingle();
      if (openAlert) {
        await supabaseAdmin
          .from("security_alerts")
          .update({ device_count: distinct.size, details: { ip, ua: data.userAgent } })
          .eq("id", openAlert.id);
      } else {
        await supabaseAdmin.from("security_alerts").insert({
          user_id: userId,
          email,
          reason: "Multiple devices used within 24 hours",
          device_count: distinct.size,
          details: { ip, ua: data.userAgent },
        });
      }
    }

    if (other) {
      // New device wins: every other device is signed out immediately and the
      // takeover is reported to the admin security section.
      await supabaseAdmin
        .from("device_sessions")
        .update({ is_active: false })
        .eq("user_id", userId)
        .neq("device_id", data.deviceId);

      // Count how often this account hops between phones so the admin can see
      // shared accounts, and warn the student once it becomes risky.
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("device_switch_count")
        .eq("id", userId)
        .maybeSingle();
      const switches = (prof?.device_switch_count ?? 0) + 1;
      await supabaseAdmin
        .from("profiles")
        .update({
          device_switch_count: switches,
          last_device_change_at: new Date().toISOString(),
          risk_level: switches >= 3 ? "high" : "normal",
        })
        .eq("id", userId);

      const { writeAudit } = await import("./audit.server");
      await writeAudit({
        action: "device_lock_takeover",
        targetType: "user",
        targetId: userId,
        email,
        details: { newDevice: data.deviceId, loggedOutDevice: other.device_id, ip },
      });
    }


    const access = await evaluateAccess(userId);
    if (!access.allowed) return { ok: false as const, error: access.reason! };

    await supabaseAdmin.from("device_sessions").upsert(
      {
        user_id: userId,
        device_id: data.deviceId,
        user_agent: data.userAgent ?? null,
        ip,
        is_active: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    );

    return { ok: true as const };
  });

export const endDeviceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deviceSchema.pick({ deviceId: true }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("device_sessions")
      .update({ is_active: false })
      .eq("user_id", context.userId)
      .eq("device_id", data.deviceId);
    return { ok: true as const };
  });

/** Profile page payload + a short-lived masked portal token. */
export const getMemberState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deviceSchema.pick({ deviceId: true }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: sessions } = await supabaseAdmin
      .from("device_sessions")
      .select("device_id")
      .eq("user_id", userId)
      .eq("is_active", true);
    const mine = (sessions ?? []).some((s) => s.device_id === data.deviceId);
    if ((sessions ?? []).length > 0 && !mine) {
      // This device was signed out because the account was opened elsewhere.
      return {
        allowed: false as const,
        evicted: true as const,
        reason: "You were signed out because this account was opened on another device.",
        profile: null,
        subscription: null,
        portalToken: null,
      };
    }
    if (mine) {
      await supabaseAdmin
        .from("device_sessions")
        .update({ last_seen: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("device_id", data.deviceId);
    }


    const access = await evaluateAccess(userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone, status, created_at, device_switch_count, risk_level")
      .eq("id", userId)
      .maybeSingle();
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_code, status, starts_at, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let portalToken: string | null = null;
    if (access.allowed) {
      const { signPortalToken } = await import("./portal.server");
      portalToken = signPortalToken(userId);
    }

    return {
      allowed: access.allowed,
      evicted: false as const,
      reason: access.reason ?? null,
      profile,
      subscription: sub,
      portalToken,
      deviceSwitches: profile?.device_switch_count ?? 0,
      highRisk: (profile?.device_switch_count ?? 0) >= 3,
    };

  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        oldPassword: z.string().min(1).max(72),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .max(72)
          .regex(/[A-Z]/, "Add an uppercase letter")
          .regex(/[a-z]/, "Add a lowercase letter")
          .regex(/[0-9]/, "Add a number")
          .regex(/[^A-Za-z0-9]/, "Add a special character"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string })?.email;
    if (!email) return { ok: false as const, error: "Session error. Sign in again." };

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const checker = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const check = await checker.auth.signInWithPassword({
      email,
      password: data.oldPassword,
    });
    if (check.error) return { ok: false as const, error: "Old password is incorrect." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) return { ok: false as const, error: "Could not update password." };
    return { ok: true as const };
  });

export const sendFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["feedback", "report"]),
        message: z.string().trim().min(5).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback").insert({
      user_id: context.userId,
      kind: data.kind,
      message: data.message,
    });
    if (error) return { ok: false as const, error: "Could not send. Try again." };
    return { ok: true as const };
  });

/**
 * Masked launch path for the member's batches (only for active members).
 * Never returns the upstream content address: the reader always goes through
 * our own /api/portal/ proxy, so the source host stays hidden from the client.
 */
export const getPortalTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await evaluateAccess(context.userId);
    if (!access.allowed)
      return { url: null as string | null, reason: access.reason ?? null, bypass: false };
    // When the admin has configured a firewall bypass header, the members request
    // must go through our server (only it can send that header). Otherwise the
    // browser navigates to the content host directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("app_content_config")
      .select("content_headers")
      .eq("id", 1)
      .maybeSingle();
    let bypass = false;
    try {
      const parsed = JSON.parse((settings?.content_headers ?? "").trim() || "{}");
      bypass = !!parsed && typeof parsed === "object" && Object.keys(parsed).length > 0;
    } catch {
      bypass = false;
    }
    return { url: "/api/portal/", reason: null as string | null, bypass };
  });


/** Notifications the admin sent to this member. */
export const getMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("notifications")
      .select("id, title, body, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: data ?? [] };
  });

export const deleteMyNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

export const clearMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").delete().eq("user_id", context.userId);
    return { ok: true as const };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true as const };
  });
