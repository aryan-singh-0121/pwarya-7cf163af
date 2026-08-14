import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordScore } from "@/lib/site";
import { signUpWithAccessKey } from "@/lib/public.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account with Access Key — PW ARYA" },
      {
        name: "description",
        content:
          "Use the access key emailed after payment approval to create your PW ARYA member account.",
      },
      { property: "og:title", content: "Create Account — PW ARYA" },
      {
        property: "og:description",
        content: "Redeem your PW ARYA access key and start learning instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    accessKey: "",
  });
  const [busy, setBusy] = useState(false);
  const strength = passwordScore(form.password);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await signUpWithAccessKey({ data: form });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Account created! Please login.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
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
          <h1 className="font-display text-3xl tracking-wide">Create account</h1>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              required
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 15))}
            />
          </div>
          <div>
            <Label htmlFor="key">Access key</Label>
            <Input
              id="key"
              required
              value={form.accessKey}
              onChange={(e) => set("accessKey", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < strength.score ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Strength: {strength.label} — need 8+ chars, upper, lower, number, symbol.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={busy || strength.score < 4}>
            {busy ? "Creating..." : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already a member?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
