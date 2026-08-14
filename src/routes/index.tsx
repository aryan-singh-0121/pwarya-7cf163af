import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Zap,
  Smartphone,
  BadgeCheck,
  Upload,
  Copy,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TypingLoop } from "@/components/TypingLoop";
import { SupportPopup } from "@/components/SupportPopup";
import { fetchPlans, fetchSettings, youtubeEmbed } from "@/lib/site";
import {
  createProofUploadUrl,
  getAssetUrl,
  submitPaymentRequest,
} from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PW ARYA — Premium Study Batches, Unlocked for Members" },
      {
        name: "description",
        content:
          "Get every premium batch, lecture and note in one member area. Pay by UPI, get approved in minutes, and study without limits.",
      },
      { property: "og:title", content: "PW ARYA — Premium Study Batches" },
      {
        property: "og:description",
        content:
          "Membership access to premium study batches with UPI payment, instant admin approval and secure one-device login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, refetchInterval: 20000 });
  const plans = useQuery({ queryKey: ["plans"], queryFn: fetchPlans, refetchInterval: 20000 });
  const s = settings.data;

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!s?.qr_path) {
      setQrUrl(null);
      return;
    }
    getAssetUrl({ data: { path: s.qr_path } }).then((r) => setQrUrl(r.url));
  }, [s?.qr_path]);

  const marquee = s?.marquee_lines?.length
    ? s.marquee_lines
    : ["Premium learning, unlocked for members"];
  const embed = youtubeEmbed(s?.demo_video_url ?? "");

  return (
    <div className="hero-surface min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="animate-blink-logo font-display text-3xl tracking-[0.18em] text-primary">
          PWARYA
        </span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#pay">Get access</a>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6 text-center">
        <p className="mx-auto flex min-h-8 items-center justify-center text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          <TypingLoop lines={marquee} />
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-tight tracking-wide sm:text-7xl">
          Every premium batch, <span className="gold-text">one membership</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {s?.services_text ||
            "PW ARYA gives members instant access to premium study batches, notes and lectures."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href="#pay">Pay &amp; get access</a>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/login">Member login</Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, text: "Instant activation after approval" },
            { icon: ShieldCheck, text: "Encrypted, verified payments" },
            { icon: Smartphone, text: "One secure device per account" },
            { icon: BadgeCheck, text: "24x7 Telegram support" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="glow-card rounded-xl p-4 text-left">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {s?.highlights?.length ? (
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <h2 className="font-display text-3xl tracking-wide">Key highlights</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {s.highlights.map((h) => (
              <span
                key={h}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
              >
                {h}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-3xl tracking-wide">Membership pricing</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(plans.data ?? []).map((p) => (
            <div key={p.code} className="glow-card animate-float-soft rounded-2xl p-5">
              <p className="text-sm uppercase tracking-widest text-muted-foreground">{p.name}</p>
              <p className="mt-2 font-display text-4xl gold-text">₹{p.price_inr}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.duration_days >= 3650 ? "Lifetime access" : `${p.duration_days} days access`}
              </p>
              <Button asChild className="mt-4 w-full" size="sm">
                <a href="#pay">Choose</a>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {embed ? (
        <section className="mx-auto max-w-4xl px-5 pb-16">
          <h2 className="flex items-center gap-2 font-display text-3xl tracking-wide">
            <PlayCircle className="h-7 w-7 text-primary" /> Demo video
          </h2>
          <div className="glow-card mt-5 aspect-video overflow-hidden rounded-2xl">
            <iframe
              src={embed}
              title="PW ARYA demo"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      <PaymentSection qrUrl={qrUrl} upi={s?.upi_id ?? ""} plans={plans.data ?? []} />

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PW ARYA. All rights reserved.</p>
        <Link to="/admin" className="mt-2 inline-block text-xs hover:text-foreground">
          Admin
        </Link>
      </footer>

      <SupportPopup
        link={s?.telegram_link ?? ""}
        message={s?.support_message ?? "Chat with us on Telegram."}
      />
    </div>
  );
}

function PaymentSection({
  qrUrl,
  upi,
  plans,
}: {
  qrUrl: string | null;
  upi: string;
  plans: { code: string; name: string; price_inr: number }[];
}) {
  const [form, setForm] = useState({
    holderName: "",
    email: "",
    phone: "",
    planCode: "",
    utr: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{12}$/.test(form.utr)) {
      toast.error("UTR must be exactly 12 digits");
      return;
    }
    if (!form.planCode) {
      toast.error("Please select a plan");
      return;
    }
    if (!file) {
      toast.error("Please attach your payment screenshot");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png";
      const slot = await createProofUploadUrl({ data: { ext: safeExt as "png" } });
      const up = await supabase.storage
        .from("payment-proofs")
        .uploadToSignedUrl(slot.path, slot.token, file);
      if (up.error) throw new Error("Screenshot upload failed");

      const res = await submitPaymentRequest({
        data: { ...form, screenshotPath: slot.path },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(true);
      toast.success("Payment submitted! We will verify it shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit, please retry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="pay" className="mx-auto max-w-6xl px-5 pb-20">
      <h2 className="font-display text-3xl tracking-wide">Pay to access</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan the QR, pay your plan amount, then submit your 12-digit UTR with the screenshot.
        After approval you will receive an access key by email to create your account.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glow-card rounded-2xl p-6 text-center">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="UPI payment QR code for PW ARYA membership"
              className="mx-auto w-56 rounded-xl bg-card p-2"
              loading="lazy"
            />
          ) : (
            <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              QR will appear here
            </div>
          )}
          {upi ? (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(upi);
                toast.success("UPI ID copied");
              }}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"
            >
              <Copy className="h-4 w-4" /> {upi}
            </button>
          ) : null}
        </div>

        {done ? (
          <div className="glow-card flex flex-col items-center justify-center rounded-2xl p-8 text-center">
            <BadgeCheck className="h-12 w-12 text-success" />
            <h3 className="mt-3 font-display text-2xl tracking-wide">Submitted</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment is under verification. You will get your access key on your email
              after approval.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="glow-card space-y-4 rounded-2xl p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="holder">Account holder name</Label>
                <Input
                  id="holder"
                  required
                  maxLength={80}
                  value={form.holderName}
                  onChange={(e) => set("holderName", e.target.value)}
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
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  required
                  value={form.planCode}
                  onChange={(e) => set("planCode", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a plan</option>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} — ₹{p.price_inr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="utr">UTR number (12 digits)</Label>
              <Input
                id="utr"
                required
                inputMode="numeric"
                pattern="[0-9]{12}"
                placeholder="123456789012"
                value={form.utr}
                onChange={(e) => set("utr", e.target.value.replace(/\D/g, "").slice(0, 12))}
              />
              <p className="mt-1 text-xs text-muted-foreground">{form.utr.length}/12 digits</p>
            </div>

            <div>
              <Label htmlFor="proof">Payment screenshot</Label>
              <label
                htmlFor="proof"
                className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
              >
                <Upload className="h-4 w-4" />
                {file ? file.name : "Choose image"}
              </label>
              <input
                id="proof"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Submitting..." : "Submit payment details"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
