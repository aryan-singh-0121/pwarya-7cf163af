import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { verifyTurnstile } from "./admin.server";

const emailSchema = z.string().trim().toLowerCase().email().max(255);

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
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Enter a valid phone number"),
  planCode: z.string().trim().min(1).max(20),
  utr: z.string().trim().regex(/^[0-9]{12}$/, "UTR must be exactly 12 digits"),
  screenshotPath: z.string().trim().min(1).max(400),
  turnstileToken: z.string().optional(),
});

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

    const { error } = await supabaseAdmin.from("payment_requests").insert({
      holder_name: data.holderName,
      email: data.email,
      phone: data.phone,
      utr: data.utr,
      plan_code: data.planCode,
      screenshot_path: data.screenshotPath,
      status: "pending",
    });
    if (error) return { ok: false as const, error: "Could not submit. Please try again." };
    return { ok: true as const };
  });

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: z.string().trim().regex(/^[0-9]{10,15}$/),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[0-9]/, "Add a number")
    .regex(/[^A-Za-z0-9]/, "Add a special character"),
  accessKey: z.string().trim().min(6).max(60),
  turnstileToken: z.string().optional(),
});

/** Account creation requires an admin-issued access key from an approved payment. */
export const signUpWithAccessKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? undefined;
    if (!(await verifyTurnstile(data.turnstileToken, ip)))
      return { ok: false as const, error: "Security check failed. Please retry." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req } = await supabaseAdmin
      .from("payment_requests")
      .select("id, plan_code, access_key, status, email")
      .eq("access_key", data.accessKey.toUpperCase())
      .eq("status", "approved")
      .maybeSingle();
    if (!req) return { ok: false as const, error: "Invalid or already used access key." };

    const { data: used } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("access_key", data.accessKey.toUpperCase())
      .maybeSingle();
    if (used) return { ok: false as const, error: "This access key is already used." };

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("duration_days")
      .eq("code", req.plan_code)
      .maybeSingle();

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (created.error || !created.data.user)
      return { ok: false as const, error: created.error?.message ?? "Could not create account." };

    const userId = created.data.user.id;
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      status: "active",
    });

    const days = plan?.duration_days ?? 10;
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan_code: req.plan_code,
      status: "active",
      access_key: data.accessKey.toUpperCase(),
      expires_at: expires,
    });
    await supabaseAdmin
      .from("payment_requests")
      .update({ user_id: userId })
      .eq("id", req.id);

    return { ok: true as const };
  });
