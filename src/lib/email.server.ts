/**
 * Transactional email. Uses Resend when RESEND_API_KEY is configured,
 * otherwise it records the attempt so the admin can still copy the key manually.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] || "PW ARYA <onboarding@resend.dev>";
  if (!key) return { ok: false as const, error: "Email is not configured." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) return { ok: false as const, error: `Email failed (${res.status})` };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Email service unreachable." };
  }
}

export function accessKeyEmail(name: string, accessKey: string, planName: string) {
  return `
  <div style="font-family:Arial,sans-serif;background:#0b1020;color:#e8ecf7;padding:28px;border-radius:14px">
    <h1 style="letter-spacing:3px;color:#f5c451;margin:0 0 12px">PW ARYA</h1>
    <p>Hi ${name},</p>
    <p>Your payment has been <b style="color:#4ade80">approved</b> for the <b>${planName}</b> plan.</p>
    <p>Your access key:</p>
    <p style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#f5c451">${accessKey}</p>
    <p>You can log in with your email &amp; password, your phone number &amp; password, or this access key.</p>
    <p style="opacity:.7;font-size:12px">One account works on one device at a time.</p>
  </div>`;
}

export function decisionEmail(name: string, reason: string) {
  return `
  <div style="font-family:Arial,sans-serif;background:#0b1020;color:#e8ecf7;padding:28px;border-radius:14px">
    <h1 style="letter-spacing:3px;color:#f5c451;margin:0 0 12px">PW ARYA</h1>
    <p>Hi ${name},</p>
    <p>Your payment request could not be approved.</p>
    <p><b>Reason:</b> ${reason}</p>
    <p>You can track your UTR status any time on our website.</p>
  </div>`;
}
