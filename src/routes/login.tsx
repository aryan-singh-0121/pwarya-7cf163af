import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, LogIn, Wallet, Search, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { startDeviceSession } from "@/lib/member.functions";
import { memberSignIn, trackUtr } from "@/lib/public.functions";
import { fetchPlans } from "@/lib/site";
import { getDeviceId } from "@/hooks/useDeviceId";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Member Login — PW ARYA" },
      {
        name: "description",
        content:
          "Sign in with your email, phone number or access key to open your PW ARYA premium study batches.",
      },
      { property: "og:title", content: "Member Login — PW ARYA" },
      { property: "og:description", content: "Secure one-device login for PW ARYA members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

type Tab = "login" | "buy" | "track";

function LoginPage() {
  const [tab, setTab] = useState<Tab>("login");

  return (
    <div className="hero-surface min-h-screen px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="animate-blink-logo block text-center font-display text-4xl tracking-[0.18em] text-primary"
        >
          PWARYA
        </Link>

        <div className="mt-8 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card/60 p-1">
          <TabButton active={tab === "login"} onClick={() => setTab("login")} icon={<LogIn className="h-4 w-4" />}>
            Login
          </TabButton>
          <TabButton active={tab === "buy"} onClick={() => setTab("buy")} icon={<Wallet className="h-4 w-4" />}>
            Buy a plan
          </TabButton>
          <TabButton active={tab === "track"} onClick={() => setTab("track")} icon={<Search className="h-4 w-4" />}>
            Track UTR
          </TabButton>
        </div>

        {tab === "login" ? <LoginForm /> : tab === "buy" ? <BuyPanel /> : <TrackPanel />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wide transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [human, setHuman] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!human) {
      toast.error("Please complete the human verification");
      return;
    }
    setBusy(true);
    try {
      const signIn = await memberSignIn({ data: { identifier, password } });
      if (!signIn.ok) {
        toast.error(signIn.error ?? "Invalid credentials");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: signIn.accessToken,
        refresh_token: signIn.refreshToken,
      });
      if (error) {
        toast.error("Invalid credentials");
        return;
      }
      const res = await startDeviceSession({
        data: { deviceId: getDeviceId(), userAgent: navigator.userAgent },
      });
      if (!res.ok) {
        await supabase.auth.signOut();
        toast.error(res.error);
        return;
      }
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glow-card mt-5 space-y-4 rounded-2xl p-6">
      <h1 className="font-display text-3xl tracking-wide">Member login</h1>
      <div>
        <Label htmlFor="identifier">Email, phone number or access key</Label>
        <Input
          id="identifier"
          required
          autoComplete="username"
          placeholder="you@mail.com / 9876543210 / PWARYA-XXXX-00"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={() => setHuman((h) => !h)}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
          human ? "border-success/60 bg-success/10 text-success" : "border-border"
        }`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border ${
            human ? "border-success bg-success/20" : "border-muted-foreground"
          }`}
        >
          {human ? "✓" : ""}
        </span>
        <ShieldCheck className="h-4 w-4" />
        {human ? "Verified — you are human" : "Click to verify you are human"}
      </button>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Verifying..." : "Login"}
      </Button>
    </form>
  );
}

function BuyPanel() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  return (
    <div className="glow-card mt-5 space-y-4 rounded-2xl p-6">
      <h1 className="font-display text-3xl tracking-wide">Buy a plan</h1>
      <p className="text-sm text-muted-foreground">
        Pick a membership, scan the UPI QR for that exact amount and submit your 12-digit UTR.
      </p>
      <div className="space-y-2">
        {(plans.data ?? []).map((p) => (
          <div
            key={p.code}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.duration_days >= 3650 ? "Lifetime access" : `${p.duration_days} days access`}
              </p>
            </div>
            <span className="gold-text font-display text-2xl">₹{p.price_inr}</span>
          </div>
        ))}
      </div>
      <Button asChild className="w-full">
        <Link to="/" hash="pay">
          Continue to payment
        </Link>
      </Button>
    </div>
  );
}

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { hour12: false });
}

function TrackPanel() {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof trackUtr>> | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{12}$/.test(utr)) {
      toast.error("UTR must be exactly 12 digits");
      return;
    }
    setBusy(true);
    try {
      setResult(await trackUtr({ data: { utr } }));
    } finally {
      setBusy(false);
    }
  }

  const status = result?.found ? result.status : null;

  return (
    <div className="mt-5 space-y-4">
      <form onSubmit={onSubmit} className="glow-card space-y-4 rounded-2xl p-6">
        <h1 className="font-display text-3xl tracking-wide">Track my UTR</h1>
        <div>
          <Label htmlFor="utr">UTR number (12 digits)</Label>
          <Input
            id="utr"
            inputMode="numeric"
            placeholder="123456789012"
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
          />
          <p className="mt-1 text-xs text-muted-foreground">{utr.length}/12 digits</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Checking..." : "Check status"}
        </Button>
        <Link to="/track" className="block text-center text-xs text-muted-foreground hover:text-foreground">
          Open the full tracker
        </Link>
      </form>

      {result && !result.found ? (
        <p className="glow-card rounded-2xl p-5 text-center text-sm text-muted-foreground">
          No payment found for this UTR.
        </p>
      ) : null}

      {result?.found ? (
        <div className="glow-card space-y-2 rounded-2xl p-5 text-sm">
          <div className="flex items-center gap-2">
            {status === "approved" ? (
              <CheckCircle2 className="h-6 w-6 text-success" />
            ) : status === "denied" ? (
              <XCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Clock className="h-6 w-6 text-accent" />
            )}
            <p className="font-display text-2xl uppercase tracking-wide">
              {status === "approved" ? "Approved" : status === "denied" ? "Rejected" : "Under review"}
            </p>
          </div>
          <p className="text-muted-foreground">Submitted: {fmt(result.createdAt)}</p>
          {status === "denied" && result.reason ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <b>Reason:</b> {result.reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
