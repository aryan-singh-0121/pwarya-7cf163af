/** Builds a standard UPI deep link so any UPI app can open with the amount pre-filled. */
export function buildUpiLink(opts: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  note?: string;
}) {
  if (!opts.upiId) return "";
  const params = new URLSearchParams();
  params.set("pa", opts.upiId);
  params.set("pn", opts.payeeName || "PW ARYA");
  if (opts.amount && opts.amount > 0) params.set("am", String(opts.amount));
  params.set("cu", "INR");
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString()}`;
}
