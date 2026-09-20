import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Stadia <noreply@stadia.app>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] Would send "${subject}" to ${to}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

// ── templates ────────────────────────────────────────────────────────────────

export function passwordResetHtml(resetUrl: string, name: string) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="font-size:22px;font-weight:800;color:#111827;margin-bottom:8px">Reset your password</h1>
  <p style="color:#374151">Hi ${escHtml(name)},</p>
  <p style="color:#374151">We received a request to reset the password for your Stadia account. Click the button below — this link expires in <strong>1 hour</strong>.</p>
  <a href="${escHtml(resetUrl)}"
     style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">
    Reset password →
  </a>
  <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">Stadia · Tournament Management Platform</p>
</div>`;
}

export function registrationConfirmedHtml({
  tournamentName, teamName, contactName, entryFee, currency, tournamentUrl,
}: { tournamentName: string; teamName: string; contactName: string; entryFee: number; currency: string; tournamentUrl: string; }) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="font-size:22px;font-weight:800;color:#111827;margin-bottom:8px">Registration Confirmed</h1>
  <p style="color:#374151">Hi ${escHtml(contactName)},</p>
  <p style="color:#374151"><strong>${escHtml(teamName)}</strong> has been confirmed for <strong>${escHtml(tournamentName)}</strong>.${entryFee > 0 ? ` Entry fee paid: <strong>${entryFee} ${escHtml(currency)}</strong>.` : ""}</p>
  <a href="${escHtml(tournamentUrl)}"
     style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">
    View tournament →
  </a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">Stadia · Tournament Management Platform</p>
</div>`;
}

export function scoreAlertHtml({
  tournamentName, homeTeam, awayTeam, homeScore, awayScore, tournamentUrl,
}: { tournamentName: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; tournamentUrl: string; }) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="font-size:22px;font-weight:800;color:#111827;margin-bottom:8px">Match Result — ${escHtml(tournamentName)}</h1>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;text-align:center;margin:16px 0">
    <p style="font-size:18px;font-weight:800;color:#111827;margin:0">
      ${escHtml(homeTeam)} <span style="color:#16a34a">${homeScore} – ${awayScore}</span> ${escHtml(awayTeam)}
    </p>
  </div>
  <a href="${escHtml(tournamentUrl)}"
     style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0">
    View standings →
  </a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">Stadia · You're receiving this because you follow ${escHtml(tournamentName)}.</p>
</div>`;
}

function escHtml(s: string | number) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
