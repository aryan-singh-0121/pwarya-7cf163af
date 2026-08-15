import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { verifyTurnstile } from "./admin.server";
import { writeAudit } from "./audit.server";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

/** Signed URL for the QR image + demo assets stored in the private bucket. */
export const getAssetUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string }) =>
    z.object({ path: z.string().min(1).max(400) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("site-assets")
      .createSignedUrl(data.path, 60 * 30);
    return { url: signed?.signedUrl ?? null };
  });

/** Anonymous visitors get a one-shot upload slot for their payment screenshot. */
export const createProofUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { ext: string }) =>
    z.object({ ext: z.enum(["png", "jpg", "jpeg", "webp"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `proofs/${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("payment-proofs")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Upload slot could not be created");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

const submitSchema = z.object({
  holderName: z.string().trim().min(2, "Name is too short").max(80),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  planCode: z.string().trim().min(1).max(20),
  utr: z.string().trim().regex(/^[0-9]{12}$/, "UTR must be exactly 12 digits"),
  screenshotPath: z.string().trim().min(1).max(400),
  turnstileToken: z.string().optional(),
});

/**
 * Single-step purchase: the member sets their own login credentials here.
 * The account is created immediately but stays locked until an admin approves
 * the payment, at which point the subscription (and access) switches on.
 */
export const submitPaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? undefined;
    const human = await verifyTurnstile(data.turnstileToken, ip);
    if (!human) return { ok: false as const, error: "Security check failed. Please retry." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("code")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan) return { ok: false as const, error: "Please choose a valid plan." };

    const { data: dupe } = await supabaseAdmin
      .from("payment_requests")
      .select("id")
      .eq("utr", data.utr)
      .maybeSingle();
    if (dupe) return { ok: false as const, error: "This UTR has already been submitted." };

    // Existing member renewing, or a brand new account?
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    let userId = existing?.id ?? null;

    if (!userId) {
      const { data: phoneTaken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", data.phone)
        .maybeSingle();
      if (phoneTaken)
        return {
          ok: false as const,
          error: "This phone number is already registered. Use your existing email.",
        };

      const created = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.holderName, phone: data.phone },
      });
      if (created.error || !created.data.user)
        return {
          ok: false as const,
          error: created.error?.message ?? "Could not create your account.",
        };
      userId = created.data.user.id;
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        full_name: data.holderName,
        email: data.email,
        phone: data.phone,
        status: "pending",
      });
    }

    const { error } = await supabaseAdmin.from("payment_requests").insert({
      user_id: userId,
      holder_name: data.holderName,
      email: data.email,
      phone: data.phone,
      utr: data.utr,
      plan_code: data.planCode,
      screenshot_path: data.screenshotPath,
      status: "pending",
    });
    if (error) return { ok: false as const, error: "Could not submit. Please try again." };

    await writeAudit({
      action: "payment_submitted",
      targetType: "payment_request",
      targetId: data.utr,
      email: data.email,
      details: { plan: data.planCode, ip: ip ?? null, newAccount: !existing },
    });

    return { ok: true as const };
  });

/** Public UTR tracker so buyers can see approve/deny status and the reason. */
export const trackUtr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ utr: z.string().trim().regex(/^[0-9]{12}$/, "UTR must be 12 digits") }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("payment_requests")
      .select("holder_name, plan_code, status, deny_reason, admin_note, created_at, decided_at")
      .eq("utr", data.utr)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!req) return { found: false as const };
    return {
      found: true as const,
      holderName: req.holder_name,
      planCode: req.plan_code,
      status: req.status,
      reason: req.deny_reason ?? req.admin_note ?? null,
      createdAt: req.created_at,
      decidedAt: req.decided_at,
    };
  });

/**
 * Members may log in with email, 10-digit phone number, or their access key.
 * This resolves any of those to the account email for the password sign-in.
 */
/**
 * Resolves email/phone/access-key AND signs in, entirely server-side.
 * Never echoes the account email back, so the endpoint cannot be used to
 * enumerate members or harvest addresses.
 */
export const memberSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(3).max(255),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const raw = data.identifier.trim();

    let email: string | null = null;
    if (raw.includes("@")) {
      email = raw.toLowerCase();
    } else if (/^[0-9]{10}$/.test(raw)) {
      const { data: byPhone } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("phone", raw)
        .maybeSingle();
      email = byPhone?.email ?? null;
    } else {
      const key = raw.toUpperCase();
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id")
        .eq("access_key", key)
        .maybeSingle();
      if (sub) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", sub.user_id)
          .maybeSingle();
        email = p?.email ?? null;
      } else {
        const { data: req } = await supabaseAdmin
          .from("payment_requests")
          .select("email")
          .eq("access_key", key)
          .eq("status", "approved")
          .maybeSingle();
        email = req?.email ?? null;
      }
    }

    // Same generic failure for "unknown identifier" and "wrong password".
    const fail = { ok: false as const, error: "Invalid credentials" };
    if (!email) return fail;

    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signed, error } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !signed.session) return fail;

    return {
      ok: true as const,
      accessToken: signed.session.access_token,
      refreshToken: signed.session.refresh_token,
    };
  });
