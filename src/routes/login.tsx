import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { startDeviceSession } from "@/lib/member.functions";
import { getDeviceId } from "@/hooks/useDeviceId";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Member Login — PW ARYA" },
      {
        name: "description",
        content: "Sign in to your PW ARYA membership to open your premium study batches.",
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Invalid email or password");
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Verifying..." : "Login"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Have an access key?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Create your account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
