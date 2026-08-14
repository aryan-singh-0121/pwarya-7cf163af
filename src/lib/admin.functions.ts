import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  adminSessionConfig,
  generateAccessKey,
  requireAdmin,
  safeEqual,
  type AdminSession,
} from "./admin.server";

const PURGE_MINUTES = 10;

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: z.string().trim().min(1).max(80),
        password: z.string().min(1).max(200),
        human: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.human !== true)
      return { ok: false as const, error: "Please complete the human verification." };
    const user = process.env["ADMIN_USERNAME"];
    const pass = process.env["ADMIN_PASSWORD"];
    if (!user || !pass) return { ok: false as const, error: "Admin is not configured." };
    if (!safeEqual(data.username, user) || !safeEqual(data.password, pass)) {
      await new Promise((r) => setTimeout(r, 400));
      return { ok: false as const, error: "Invalid credentials." };
    }
    const session = await useSession<AdminSession>(adminSessionConfig());
    await session.update({ admin: true, user });
    const { writeAudit } = await import("./audit.server");
    await writeAudit({ actor: user, action: "admin_login", targetType: "admin" });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminMe = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(adminSessionConfig());
  return { admin: session.data.admin === true, user: session.data.user ?? null };
});

export const adminOverview = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [requests, users, subs, alerts, fb, settings, plans, devices, audit] = await Promise.all([
    supabaseAdmin
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("security_alerts").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("feedback").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("plans").select("*").order("sort_order"),
    supabaseAdmin.from("device_sessions").select("*").order("last_seen", { ascending: false }).limit(300),
    supabaseAdmin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
  ]);

  const withProof = await Promise.all(
    (requests.data ?? []).map(async (r) => {
      let proofUrl: string | null = null;
      if (r.screenshot_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("payment-proofs")
          .createSignedUrl(r.screenshot_path, 60 * 15);
        proofUrl = signed?.signedUrl ?? null;
      }
      return { ...r, proofUrl };
    }),
  );

  return {
    requests: withProof,
    users: users.data ?? [],
    subscriptions: subs.data ?? [],
    alerts: alerts.data ?? [],
    feedback: fb.data ?? [],
    settings: settings.data ?? null,
    plans: plans.data ?? [],
    devices: devices.data ?? [],
    audit: audit.data ?? [],
  };
});

export const decidePayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "denied"]),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const session = await requireAdmin();
    const actor = session.data.user ?? "admin";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./audit.server");

    if (data.decision === "denied" && !data.reason)
      return { ok: false as const, error: "Please write a reason for the rejection." };

    const { data: req } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) return { ok: false as const, error: "Request not found." };

    const accessKey = data.decision === "approved" ? generateAccessKey() : null;
    const purgeAt = new Date(Date.now() + PURGE_MINUTES * 60000).toISOString();

    await supabaseAdmin
      .from("payment_requests")
      .update({
        status: data.decision,
        admin_note: data.reason ?? null,
        deny_reason: data.decision === "denied" ? (data.reason ?? null) : null,
        access_key: accessKey,
        decided_at: new Date().toISOString(),
        purge_at: purgeAt,
      })
      .eq("id", data.id);

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("duration_days, name")
      .eq("code", req.plan_code)
      .maybeSingle();

    // The buyer already set their credentials at payment time — switch access on.
    if (data.decision === "approved") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", req.email)
        .maybeSingle();
      if (profile) {
        const days = plan?.duration_days ?? 10;
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", profile.id)
          .eq("status", "active");
        await supabaseAdmin.from("subscriptions").insert({
          user_id: profile.id,
          plan_code: req.plan_code,
          status: "active",
          access_key: accessKey,
          expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        });
        await supabaseAdmin.from("profiles").update({ status: "active" }).eq("id", profile.id);
        await supabaseAdmin
          .from("payment_requests")
          .update({ user_id: profile.id })
          .eq("id", data.id);
      }
    }

    // Proof screenshots are deleted the moment a decision is made.
    let proofDeleted = false;
    if (req.screenshot_path) {
      const { error: delErr } = await supabaseAdmin.storage
        .from("payment-proofs")
        .remove([req.screenshot_path]);
      proofDeleted = !delErr;
      if (proofDeleted) {
        await supabaseAdmin
          .from("payment_requests")
          .update({ screenshot_path: null, proof_deleted_at: new Date().toISOString() })
          .eq("id", data.id);
      }
      await writeAudit({
        actor,
        action: proofDeleted ? "proof_deleted" : "proof_delete_failed",
        targetType: "payment_request",
        targetId: req.id,
        email: req.email,
        details: { path: req.screenshot_path, utr: req.utr },
      });
    }

    // Notify the buyer by email (best effort).
    let emailed = false;
    try {
      const { sendEmail, accessKeyEmail, decisionEmail } = await import("./email.server");
      const mail =
        data.decision === "approved"
          ? await sendEmail({
              to: req.email,
              subject: "Your PW ARYA access key",
              html: accessKeyEmail(req.holder_name, accessKey!, plan?.name ?? req.plan_code),
            })
          : await sendEmail({
              to: req.email,
              subject: "PW ARYA payment update",
              html: decisionEmail(req.holder_name, data.reason ?? "Payment could not be verified."),
            });
      emailed = mail.ok;
    } catch {
      emailed = false;
    }

    await writeAudit({
      actor,
      action: data.decision === "approved" ? "payment_approved" : "payment_denied",
      targetType: "payment_request",
      targetId: req.id,
      email: req.email,
      details: {
        utr: req.utr,
        plan: req.plan_code,
        reason: data.reason ?? null,
        accessKey,
        emailed,
        proofDeleted,
      },
    });

    return { ok: true as const, accessKey, emailed, proofDeleted };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80),
        email: z.string().trim().toLowerCase().email().max(255),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/),
        password: z.string().min(8).max(72),
        planCode: z.string().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("duration_days")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan) return { ok: false as const, error: "Unknown plan." };

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (created.error || !created.data.user)
      return { ok: false as const, error: created.error?.message ?? "Could not create user." };

    const userId = created.data.user.id;
    const accessKey = generateAccessKey();
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
    });
    await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      plan_code: data.planCode,
      status: "active",
      access_key: accessKey,
      expires_at: new Date(Date.now() + plan.duration_days * 86400000).toISOString(),
    });
    return { ok: true as const, accessKey };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("device_sessions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("feedback").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    const { writeAudit } = await import("./audit.server");
    await writeAudit({ action: "user_deleted", targetType: "user", targetId: data.userId });
    return { ok: true as const };
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended"]),
        cancelSubscription: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (data.status === "suspended") {
      await supabaseAdmin
        .from("device_sessions")
        .update({ is_active: false })
        .eq("user_id", data.userId);
      if (data.cancelSubscription) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("user_id", data.userId)
          .eq("status", "active");
      }
    }
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      action: data.status === "suspended" ? "user_suspended" : "user_activated",
      targetType: "user",
      targetId: data.userId,
      details: { cancelSubscription: data.cancelSubscription ?? false },
    });
    return { ok: true as const };
  });

export const adminResetDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("device_sessions")
      .update({ is_active: false })
      .eq("user_id", data.userId);
    const { writeAudit } = await import("./audit.server");
    await writeAudit({ action: "device_lock_reset", targetType: "user", targetId: data.userId });
    return { ok: true as const };
  });

export const adminResolveAlert = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_alerts").update({ status: "resolved" }).eq("id", data.id);
    return { ok: true as const };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        upi_id: z.string().trim().max(120),
        qr_path: z.string().trim().max(400),
        telegram_link: z.string().trim().max(300),
        support_message: z.string().trim().max(300),
        services_text: z.string().trim().max(4000),
        demo_video_url: z.string().trim().max(400),
        content_url: z.string().trim().url().max(400),
        highlights: z.array(z.string().trim().max(120)).max(12),
        marquee_lines: z.array(z.string().trim().max(120)).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_settings").update(data).eq("id", 1);
    if (error) return { ok: false as const, error: "Could not save settings." };
    return { ok: true as const };
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(20),
        name: z.string().trim().min(1).max(60),
        price_inr: z.number().int().min(0).max(1000000),
        duration_days: z.number().int().min(1).max(40000),
        is_active: z.boolean(),
        sort_order: z.number().int().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("plans").upsert(data, { onConflict: "code" });
    return { ok: true as const };
  });

export const adminAssetUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ext: z.enum(["png", "jpg", "jpeg", "webp"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `qr/${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("site-assets")
      .createSignedUploadUrl(path);
    if (error || !signed) return { ok: false as const, error: "Upload failed." };
    return { ok: true as const, path, token: signed.token };
  });
