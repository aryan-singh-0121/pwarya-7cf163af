import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  User,
  ShieldAlert,
  RefreshCw,
  Rocket,
  BookOpen,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  changeMyPassword,
  endDeviceSession,
  getMemberState,
  getMyNotifications,
  getPortalTarget,
  markNotificationsRead,
  sendFeedback,
} from "@/lib/member.functions";

import { getDeviceId } from "@/hooks/useDeviceId";
import { passwordScore } from "@/lib/site";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Member Area — PW ARYA" },
      {
        name: "description",
        content: "Your PW ARYA member area: premium batches, plan details and profile settings.",
      },
      { property: "og:title", content: "Member Area — PW ARYA" },
      { property: "og:description", content: "Premium study batches for PW ARYA members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"study" | "alerts" | "profile">("study");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => setDeviceId(getDeviceId()), []);

  const state = useQuery({
    queryKey: ["member", deviceId],
    enabled: !!deviceId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/login" });
        return null;
      }
      return getMemberState({ data: { deviceId } });
    },
  });

  async function logout() {
    if (deviceId) await endDeviceSession({ data: { deviceId } }).catch(() => null);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const s = state.data;

  // Signed out remotely: the account was opened on another device.
  useEffect(() => {
    if (s && "evicted" in s && s.evicted) {
      toast.error("Signed out — this account was opened on another device.");
      void supabase.auth.signOut().then(() => navigate({ to: "/login" }));
    }
  }, [s, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="animate-blink-logo font-display text-2xl tracking-[0.18em] text-primary">
          PWARYA
        </span>
        <span className="text-xs text-muted-foreground">Member area</span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col pb-20">
        {state.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Loading your member area...
          </div>
        ) : !s ? null : !s.allowed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h1 className="font-display text-3xl tracking-wide">Access unavailable</h1>
            <p className="max-w-md text-sm text-muted-foreground">{s.reason}</p>
            <Button onClick={() => navigate({ to: "/" })}>Renew membership</Button>
            <Button variant="ghost" onClick={() => state.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Retry
            </Button>
          </div>
        ) : tab === "study" ? (
          <BatchLauncher />
        ) : tab === "alerts" ? (
          <NotificationsPanel />
        ) : (
          <ProfilePanel
            profile={s.profile}
            subscription={s.subscription}
            onRefresh={() => state.refetch()}
          />
        )}
      </main>

      {/* Bottom navigation: Study · Notifications · Profile · Logout */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur">
          <BottomTab
            active={tab === "study"}
            icon={<BookOpen className="h-5 w-5" />}
            label="Study"
            onClick={() => setTab("study")}
          />
          <BottomTab
            active={tab === "alerts"}
            icon={<Bell className="h-5 w-5" />}
            label="Alerts"
            onClick={() => setTab("alerts")}
          />
          <BottomTab
            active={tab === "profile"}
            icon={<User className="h-5 w-5" />}
            label="Profile"
            onClick={() => setTab("profile")}
          />
          <BottomTab
            active={false}
            icon={<LogOut className="h-5 w-5" />}
            label="Logout"
            onClick={logout}
          />
      </nav>
    </div>
  );
}

function BottomTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 text-xs font-semibold transition ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}


type Profile = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
} | null;

type Sub = {
  plan_code: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
} | null;


function BatchLauncher() {
  const [busy, setBusy] = useState(false);

  const openBatches = async () => {
    setBusy(true);
    try {
      // With a firewall bypass header configured, the request must leave from our
      // server (only it can attach the secret header) — otherwise navigate directly.
      const res = await getPortalTarget();
      if (res.bypass && res.url) window.location.assign(res.url);
      else window.location.assign("https://pwthor.live/study/batches");
    } catch {
      window.location.assign("https://pwthor.live/study/batches");
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <Button size="lg" disabled={busy} onClick={openBatches}>
        <Rocket className="mr-2 h-5 w-5" /> {busy ? "Opening…" : "Open batches"}
      </Button>
    </div>
  );
}


function ProfilePanel({
  profile,
  subscription,
  onRefresh,
}: {
  profile: Profile;
  subscription: Sub;
  onRefresh: () => void;
}) {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"feedback" | "report">("feedback");
  const strength = passwordScore(newPassword);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const res = await changeMyPassword({ data: { oldPassword, newPassword } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOld("");
    setNew("");
    toast.success("Password updated");
  }

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    const res = await sendFeedback({ data: { kind, message } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMessage("");
    toast.success("Thanks, we received it");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <section className="glow-card rounded-2xl p-6">
        <h2 className="font-display text-2xl tracking-wide">My details</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Name", profile?.full_name],
            ["Email", profile?.email],
            ["Phone", profile?.phone],
            ["Account status", profile?.status],
            ["Plan", subscription?.plan_code ?? "—"],
            [
              "Valid till",
              subscription?.expires_at
                ? new Date(subscription.expires_at).toLocaleDateString()
                : "—",
            ],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
              <dd className="text-sm">{(v as string) ?? "—"}</dd>
            </div>
          ))}
        </dl>
        <Button variant="ghost" size="sm" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </section>

      <form onSubmit={changePw} className="glow-card space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-2xl tracking-wide">Change password</h2>
        <div>
          <Label htmlFor="old">Old password</Label>
          <Input
            id="old"
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOld(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="new">New password</Label>
          <Input
            id="new"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Strength: {strength.label}</p>
        </div>
        <Button type="submit" disabled={strength.score < 4}>
          Update password
        </Button>
      </form>

      <form onSubmit={submitFeedback} className="glow-card space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-2xl tracking-wide">Report / feedback</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "feedback" ? "default" : "secondary"}
            onClick={() => setKind("feedback")}
          >
            Feedback
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "report" ? "default" : "secondary"}
            onClick={() => setKind("report")}
          >
            Report issue
          </Button>
        </div>
        <Textarea
          required
          minLength={5}
          maxLength={1000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}

function NotificationsPanel() {
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getMyNotifications(),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (list.data?.items?.length) void markNotificationsRead();
  }, [list.data]);

  const items = list.data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">Notifications</h2>
        <Button variant="ghost" size="sm" onClick={() => list.refetch()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        items.map((n) => (
          <article key={n.id} className="glow-card rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{n.title}</h3>
              {!n.read_at ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase text-accent">
                  New
                </span>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("en-GB", { hour12: false })}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
