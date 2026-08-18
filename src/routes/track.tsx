import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackUtr } from "@/lib/public.functions";


export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Your Payment Status — PW ARYA" },
      {
        name: "description",
        content:
          "Enter your 12-digit UTR number to see whether your PW ARYA membership payment is pending, approved or rejected, along with the admin's reason.",
      },
      { property: "og:title", content: "Track Your Payment — PW ARYA" },
      {
        property: "og:description",
        content: "Check the approval status of your PW ARYA membership payment by UTR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackPage,
});

type Result = Awaited<ReturnType<typeof trackUtr>>;

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { hour12: false });
}

function TrackPage() {
  const navigate = useNavigate();
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const utrRef = useRef("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{12}$/.test(utr)) {
      toast.error("UTR must be exactly 12 digits");
      return;
    }
    setBusy(true);
    utrRef.current = utr;
    try {
      setResult(await trackUtr({ data: { utr } }));
    } finally {
      setBusy(false);
    }
  }

  const status = result?.found ? result.status : null;

  // While a payment is under review we keep checking quietly; the moment the
  // admin approves it the buyer is taken straight to their member area.
  useEffect(() => {
    if (!result?.found || status !== "pending") return;
    const id = setInterval(async () => {
      const next = await trackUtr({ data: { utr: utrRef.current } });
      setResult(next);
    }, 8000);
    return () => clearInterval(id);
  }, [result, status]);

  useEffect(() => {
    if (status !== "approved") return;
    toast.success("Payment approved — opening your batches");
    const id = setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    return () => clearTimeout(id);
  }, [status, navigate]);


  return (
    <div className="hero-surface min-h-screen px-5 py-12">
      <div className="mx-auto w-full max-w-xl">
        <Link
          to="/"
          className="animate-blink-logo block text-center font-display text-4xl tracking-[0.18em] text-primary"
        >
          PWARYA
        </Link>
        <h1 className="mt-8 text-center font-display text-3xl tracking-wide">Track your payment</h1>

        <form onSubmit={onSubmit} className="glow-card mt-6 space-y-4 rounded-2xl p-6">
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
            <Search className="mr-2 h-4 w-4" />
            {busy ? "Checking..." : "Check status"}
          </Button>
        </form>

        {result && !result.found ? (
          <div className="glow-card mt-6 rounded-2xl p-6 text-center text-muted-foreground">
            No payment found for this UTR. Please check the number you entered.
          </div>
        ) : null}

        {result?.found ? (
          <div className="glow-card mt-6 space-y-3 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              {status === "approved" ? (
                <CheckCircle2 className="h-8 w-8 text-success" />
              ) : status === "denied" ? (
                <XCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Clock className="h-8 w-8 text-accent" />
              )}
              <p className="font-display text-3xl uppercase tracking-wide">
                {status === "approved"
                  ? "Approved"
                  : status === "denied"
                    ? "Rejected"
                    : "Under review"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Name: {result.holderName}</p>
            <p className="text-sm text-muted-foreground">Plan: {result.planCode}</p>
            <p className="text-sm text-muted-foreground">Submitted: {fmt(result.createdAt)}</p>
            <p className="text-sm text-muted-foreground">Decided: {fmt(result.decidedAt)}</p>
            {status === "denied" && result.reason ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <b>Reason from admin:</b> {result.reason}
              </div>
            ) : null}
            {status === "approved" ? (
              <p className="text-sm">
                Your access key has been emailed. You can{" "}
                <Link to="/login" className="text-primary hover:underline">
                  log in
                </Link>{" "}
                with the email/phone and password you set while paying.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
