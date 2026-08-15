import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { startDeviceSession } from "@/lib/member.functions";
import { memberSignIn } from "@/lib/public.functions";
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

function LoginPage() {
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
    <div className="hero-surface flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="animate-blink-logo block text-center font-display text-4xl tracking-[0.18em] text-primary"
        >
          PWARYA
        </Link>
        <form onSubmit={onSubmit} className="glow-card mt-8 space-y-4 rounded-2xl p-6">
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
          <div className="flex justify-between text-sm text-muted-foreground">
            <Link to="/" hash="pay" className="text-primary hover:underline">
              Buy a plan
            </Link>
            <Link to="/track" className="hover:text-foreground">
              Track my UTR
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
