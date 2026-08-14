import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAssetUploadUrl,
  adminCreateUser,
  adminDeleteUser,
  adminLogin,
  adminLogout,
  adminMe,
  adminOverview,
  adminResetDevice,
  adminResolveAlert,
  adminSavePlan,
  adminSaveSettings,
  adminSetUserStatus,
  decidePayment,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Console — PW ARYA" },
      { name: "description", content: "PW ARYA admin console for payments, members and settings." },
      { property: "og:title", content: "Admin Console — PW ARYA" },
      { property: "og:description", content: "Manage PW ARYA memberships and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  "Payments",
  "Members",
  "Security",
  "Feedback",
  "Settings",
  "Pricing",
] as const;
type Tab = (typeof TABS)[number];

function AdminPage() {
  const me = useQuery({ queryKey: ["adminMe"], queryFn: () => adminMe() });
  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }
  return me.data?.admin ? <Console onLogout={() => me.refetch()} /> : <AdminLogin onDone={() => me.refetch()} />;
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminLogin({ data: { username, password } });
      if (!res.ok) {
        toast.error(res.error ?? "Invalid credentials");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hero-surface flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="glow-card w-full max-w-sm space-y-4 rounded-2xl p-6">
        <h1 className="font-display text-3xl tracking-wide">Admin console</h1>
        <div>
          <Label htmlFor="u">Username</Label>
          <Input id="u" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="p">Password</Label>
          <Input
            id="p"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Checking..." : "Login"}
        </Button>
      </form>
    </div>
  );
}

function Console({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("Payments");
  const data = useQuery({
    queryKey: ["adminOverview"],
    queryFn: () => adminOverview(),
    refetchInterval: 15000,
  });
  const d = data.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <span className="animate-blink-logo font-display text-2xl tracking-[0.18em] text-primary">
          PWARYA ADMIN
        </span>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "ghost"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await adminLogout();
              onLogout();
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        {!d ? (
          <p className="text-muted-foreground">Loading data...</p>
        ) : tab === "Payments" ? (
          <Payments requests={d.requests} refresh={() => data.refetch()} />
        ) : tab === "Members" ? (
          <Members
            users={d.users}
            subs={d.subscriptions}
            devices={d.devices}
            plans={d.plans}
            refresh={() => data.refetch()}
          />
        ) : tab === "Security" ? (
          <Security alerts={d.alerts} refresh={() => data.refetch()} />
        ) : tab === "Feedback" ? (
          <Feedback items={d.feedback} />
        ) : tab === "Settings" ? (
          <SettingsPanel settings={d.settings} refresh={() => data.refetch()} />
        ) : (
          <Pricing plans={d.plans} refresh={() => data.refetch()} />
        )}
      </main>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function Payments({ requests, refresh }: { requests: any[]; refresh: () => void }) {
  async function decide(id: string, decision: "approved" | "denied") {
    const res = await decidePayment({ data: { id, decision } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      decision === "approved" ? `Approved. Access key: ${res.accessKey}` : "Request denied",
    );
    refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide">Payment requests</h2>
      {requests.length === 0 ? <p className="text-muted-foreground">No requests yet.</p> : null}
      {requests.map((r) => (
        <div key={r.id} className="glow-card grid gap-4 rounded-2xl p-5 sm:grid-cols-[160px_1fr]">
          {r.proofUrl ? (
            <a href={r.proofUrl} target="_blank" rel="noreferrer">
              <img
                src={r.proofUrl}
                alt={`Payment screenshot from ${r.holder_name}`}
                className="h-40 w-full rounded-lg object-cover"
              />
            </a>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Screenshot purged
            </div>
          )}
          <div className="space-y-1 text-sm">
            <p className="font-display text-xl tracking-wide">{r.holder_name}</p>
            <p className="text-muted-foreground">
              {r.email} · {r.phone}
            </p>
            <p>
              Plan <span className="text-primary">{r.plan_code}</span> · UTR {r.utr}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()} · status {r.status}
            </p>
            {r.access_key ? (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(r.access_key);
                  toast.success("Access key copied");
                }}
                className="rounded-md border border-border px-3 py-1 text-xs"
              >
                Copy access key: {r.access_key}
              </button>
            ) : null}
            {r.status === "pending" ? (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => decide(r.id, "approved")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decide(r.id, "denied")}
                >
                  Deny
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Members({
  users,
  subs,
  devices,
  plans,
  refresh,
}: {
  users: any[];
  subs: any[];
  devices: any[];
  plans: any[];
  refresh: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    planCode: plans[0]?.code ?? "",
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await adminCreateUser({ data: form });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Created. Access key: ${res.accessKey}`);
    setForm({ ...form, fullName: "", email: "", phone: "", password: "" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="glow-card space-y-3 rounded-2xl p-5">
        <h2 className="font-display text-2xl tracking-wide">Create member manually</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Full name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            placeholder="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            placeholder="Password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            value={form.planCode}
            onChange={(e) => setForm({ ...form, planCode: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Create member</Button>
      </form>

      <h2 className="font-display text-2xl tracking-wide">Members ({users.length})</h2>
      <div className="space-y-3">
        {users.map((u) => {
          const sub = subs.find((s) => s.user_id === u.id && s.status === "active");
          const dev = devices.filter((x) => x.user_id === u.id && x.is_active);
          return (
            <div key={u.id} className="glow-card rounded-2xl p-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-xl tracking-wide">{u.full_name}</p>
                  <p className="text-muted-foreground">
                    {u.email} · {u.phone} · {u.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plan {sub?.plan_code ?? "none"} ·{" "}
                    {sub?.expires_at
                      ? `till ${new Date(sub.expires_at).toLocaleDateString()}`
                      : "no active subscription"}{" "}
                    · devices {dev.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await adminResetDevice({ data: { userId: u.id } });
                      toast.success("Device lock reset");
                      refresh();
                    }}
                  >
                    Reset device
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await adminSetUserStatus({
                        data: {
                          userId: u.id,
                          status: u.status === "suspended" ? "active" : "suspended",
                          cancelSubscription: u.status !== "suspended",
                        },
                      });
                      refresh();
                    }}
                  >
                    {u.status === "suspended" ? "Unsuspend" : "Suspend + cancel"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Delete ${u.email}?`)) return;
                      await adminDeleteUser({ data: { userId: u.id } });
                      toast.success("User deleted");
                      refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Security({ alerts, refresh }: { alerts: any[]; refresh: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide">Detected behaviour</h2>
      {alerts.length === 0 ? <p className="text-muted-foreground">No alerts.</p> : null}
      {alerts.map((a) => (
        <div key={a.id} className="glow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 text-sm">
          <div>
            <p className="font-semibold">{a.email}</p>
            <p className="text-muted-foreground">
              {a.reason} · {a.device_count} devices · {new Date(a.created_at).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Status: {a.status}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await adminSetUserStatus({
                  data: { userId: a.user_id, status: "suspended", cancelSubscription: true },
                });
                toast.success("Account suspended and subscription cancelled");
                refresh();
              }}
            >
              Suspend + cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await adminResolveAlert({ data: { id: a.id } });
                refresh();
              }}
            >
              Resolve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Feedback({ items }: { items: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide">Feedback &amp; reports</h2>
      {items.length === 0 ? <p className="text-muted-foreground">Nothing yet.</p> : null}
      {items.map((f) => (
        <div key={f.id} className="glow-card rounded-2xl p-5 text-sm">
          <p className="text-xs uppercase tracking-widest text-primary">{f.kind}</p>
          <p className="mt-1">{f.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(f.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({ settings, refresh }: { settings: any; refresh: () => void }) {
  const [form, setForm] = useState({
    upi_id: "",
    qr_path: "",
    telegram_link: "",
    support_message: "",
    services_text: "",
    demo_video_url: "",
    content_url: "https://pwthor.live/study/batches",
    highlights: "",
    marquee_lines: "",
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      upi_id: settings.upi_id ?? "",
      qr_path: settings.qr_path ?? "",
      telegram_link: settings.telegram_link ?? "",
      support_message: settings.support_message ?? "",
      services_text: settings.services_text ?? "",
      demo_video_url: settings.demo_video_url ?? "",
      content_url: settings.content_url ?? "https://pwthor.live/study/batches",
      highlights: (settings.highlights ?? []).join("\n"),
      marquee_lines: (settings.marquee_lines ?? []).join("\n"),
    });
  }, [settings]);

  async function uploadQr(file: File) {
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const safe = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
    const slot = await adminAssetUploadUrl({ data: { ext: safe as "png" } });
    if (!slot.ok) {
      toast.error(slot.error);
      return;
    }
    const up = await supabase.storage
      .from("site-assets")
      .uploadToSignedUrl(slot.path, slot.token, file);
    if (up.error) {
      toast.error("Upload failed");
      return;
    }
    setForm((f) => ({ ...f, qr_path: slot.path }));
    toast.success("QR uploaded — press Save to publish");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await adminSaveSettings({
      data: {
        ...form,
        highlights: form.highlights.split("\n").map((s) => s.trim()).filter(Boolean),
        marquee_lines: form.marquee_lines.split("\n").map((s) => s.trim()).filter(Boolean),
      },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved — live on the site");
    refresh();
  }

  return (
    <form onSubmit={save} className="glow-card space-y-4 rounded-2xl p-5">
      <h2 className="font-display text-2xl tracking-wide">Live site settings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>UPI ID</Label>
          <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
        </div>
        <div>
          <Label>Telegram support link</Label>
          <Input
            value={form.telegram_link}
            onChange={(e) => setForm({ ...form, telegram_link: e.target.value })}
          />
        </div>
        <div>
          <Label>Support popup message</Label>
          <Input
            value={form.support_message}
            onChange={(e) => setForm({ ...form, support_message: e.target.value })}
          />
        </div>
        <div>
          <Label>Demo YouTube URL</Label>
          <Input
            value={form.demo_video_url}
            onChange={(e) => setForm({ ...form, demo_video_url: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Members content URL (hidden from users)</Label>
          <Input
            value={form.content_url}
            onChange={(e) => setForm({ ...form, content_url: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Payment QR image</Label>
        <input
          type="file"
          accept="image/*"
          className="mt-1 block text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadQr(f);
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">Current: {form.qr_path || "none"}</p>
      </div>
      <div>
        <Label>Services description</Label>
        <Textarea
          rows={4}
          value={form.services_text}
          onChange={(e) => setForm({ ...form, services_text: e.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Key highlights (one per line)</Label>
          <Textarea
            rows={5}
            value={form.highlights}
            onChange={(e) => setForm({ ...form, highlights: e.target.value })}
          />
        </div>
        <div>
          <Label>Animated headline lines (one per line)</Label>
          <Textarea
            rows={5}
            value={form.marquee_lines}
            onChange={(e) => setForm({ ...form, marquee_lines: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit">Save settings</Button>
    </form>
  );
}

function Pricing({ plans, refresh }: { plans: any[]; refresh: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide">Plans</h2>
      {plans.map((p) => (
        <PlanRow key={p.code} plan={p} refresh={refresh} />
      ))}
    </div>
  );
}

function PlanRow({ plan, refresh }: { plan: any; refresh: () => void }) {
  const [p, setP] = useState(plan);
  useEffect(() => setP(plan), [plan]);

  return (
    <div className="glow-card grid gap-3 rounded-2xl p-5 sm:grid-cols-6 sm:items-end">
      <div className="sm:col-span-2">
        <Label>Name</Label>
        <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </div>
      <div>
        <Label>Price ₹</Label>
        <Input
          type="number"
          value={p.price_inr}
          onChange={(e) => setP({ ...p, price_inr: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Days</Label>
        <Input
          type="number"
          value={p.duration_days}
          onChange={(e) => setP({ ...p, duration_days: Number(e.target.value) })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.is_active}
          onChange={(e) => setP({ ...p, is_active: e.target.checked })}
        />
        Active
      </label>
      <Button
        size="sm"
        onClick={async () => {
          await adminSavePlan({
            data: {
              code: p.code,
              name: p.name,
              price_inr: Number(p.price_inr),
              duration_days: Number(p.duration_days),
              is_active: !!p.is_active,
              sort_order: Number(p.sort_order ?? 0),
            },
          });
          toast.success("Plan saved");
          refresh();
        }}
      >
        Save
      </Button>
    </div>
  );
}
