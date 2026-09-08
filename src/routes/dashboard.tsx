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
  Trash2,
  AlertTriangle,
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
  markNotificationsRead,
  deleteMyNotification,
  clearMyNotifications,
  sendFeedback,
} from "@/lib/member.functions";

import { getDeviceId } from "@/hooks/useDeviceId";

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

  const highRisk = !!(s && "highRisk" in s && s.highRisk);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {s && "allowed" in s && s.allowed ? <WelcomeNotifications /> : null}
      {highRisk ? <HighRiskDialog switches={(s as { deviceSwitches?: number }).deviceSwitches ?? 3} /> : null}
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


const STUDY_STEPS = [
  {
    title: "Tap Open batches",
    text: "It takes you straight to your study library in the same window — no extra tabs, no links to copy.",
  },
  {
    title: "Pick your batch",
    text: "Choose the batch, then the subject and chapter you want to study today.",
  },
  {
    title: "Come back anytime",
    text: "Use your phone's back button to return here, or open the site again and sign in.",
  },
  {
    title: "One account, one device",
    text: "Signing in on another phone signs this one out. Keep your password private.",
  },
  {
    title: "Need help?",
    text: "Open the Alerts tab for messages from us, or send a report from the Profile tab.",
  },
];

const BATCH_URL = "https://pwthor.live/study/batches";

function BatchLauncher() {
  // The study host blocks being shown inside another page (ERR_BLOCKED_BY_RESPONSE),
  // so we always leave this page entirely: top-level navigation first, and a plain
  // new-tab open only as a fallback when the top window is not reachable.
  const openBatches = () => {
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = BATCH_URL;
        return;
      }
    } catch {
      // Cross-origin preview shell: fall through to a normal new tab.
      const a = document.createElement("a");
      a.href = BATCH_URL;
      a.target = "_top";
      a.rel = "noopener noreferrer";
      a.referrerPolicy = "no-referrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.location.href = BATCH_URL;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <section className="glow-card rounded-2xl p-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          <BookOpen className="h-3.5 w-3.5" /> Membership active
        </span>
        <h1 className="mt-4 font-display text-3xl tracking-wide">Your batches are ready</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Everything in your plan is unlocked. Tap the button below to start studying.
        </p>
        <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={openBatches}>
          <Rocket className="mr-2 h-5 w-5" /> Open batches
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Not opening?{" "}
          <a
            href={BATCH_URL}
            target="_top"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="font-semibold text-primary underline"
          >
            Tap here
          </a>
          .
        </p>
      </section>



      <section className="glow-card rounded-2xl p-6">
        <h2 className="font-display text-2xl tracking-wide">How to use</h2>
        <ol className="mt-4 space-y-4">
          {STUDY_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
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
            minLength={6}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Use at least 6 characters.</p>
        </div>
        <Button type="submit" disabled={newPassword.length < 6}>
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

  async function removeOne(id: string) {
    await deleteMyNotification({ data: { id } });
    toast.success("Notification deleted");
    void list.refetch();
  }

  const items = list.data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">Notifications</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => list.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              await clearMyNotifications();
              toast.success("All notifications deleted");
              void list.refetch();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Clear all
          </Button>
        </div>
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
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString("en-GB", { hour12: false })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => removeOne(n.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

/** One-time English warning for accounts that keep hopping between phones. */
function HighRiskDialog({ switches }: { switches: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pwarya_risk_ack") === "1") return;
    setOpen(true);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 px-5">
      <div className="glow-card w-full max-w-md space-y-4 rounded-2xl border border-destructive/50 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="font-display text-2xl tracking-wide text-destructive">
          Your account is at high risk
        </h2>
        <p className="text-sm text-muted-foreground">
          This account has been opened on {switches} different devices. One membership is for one
          student only. If device sharing continues, your account can be removed without a refund.
        </p>
        <Button
          className="w-full"
          onClick={() => {
            sessionStorage.setItem("pwarya_risk_ack", "1");
            setOpen(false);
          }}
        >
          I understand
        </Button>
      </div>
    </div>
  );
}

/** Unread notifications are shown as a popup right after login. */
function WelcomeNotifications() {
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pwarya_notif_seen") === "1") return;
    let alive = true;
    getMyNotifications()
      .then((r) => {
        if (!alive) return;
        const unread = (r.items ?? []).filter((n) => !n.read_at).slice(0, 5);
        if (unread.length) {
          setItems(unread);
          setOpen(true);
        }
        sessionStorage.setItem("pwarya_notif_seen", "1");
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  if (!open || items.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-background/90 px-5">
      <div className="glow-card w-full max-w-md space-y-3 rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">New for you</h2>
        </div>
        {items.map((n) => (
          <div key={n.id} className="rounded-xl border border-border/70 bg-card/40 p-3">
            <p className="font-semibold">{n.title}</p>
            <p className="text-sm text-muted-foreground">{n.body}</p>
          </div>
        ))}
        <Button
          className="w-full"
          onClick={() => {
            void markNotificationsRead();
            setOpen(false);
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
