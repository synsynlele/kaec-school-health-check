/**
 * KAEC School Health Check — Report email delivery.
 *
 * Sends via Resend when RESEND_API_KEY is configured. Without a provider,
 * the message is safely queued in the email_log table so nothing is lost
 * and a provider can be attached later without code changes.
 */
import { logEmail } from "./storage";
import { ratingFor } from "./scoring";
import type { ReportData } from "./types";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildReportEmailHtml(
  schoolName: string,
  report: ReportData,
  reportUrl: string,
): string {
  const rating = ratingFor(report.overallScore);
  const strengths = report.strengths
    .slice(0, 3)
    .map((s) => `<li style="margin:4px 0;color:#334155">${esc(s.title)}</li>`)
    .join("");
  const priorities = report.priorityAreas
    .map((p) => `<li style="margin:4px 0;color:#334155">${esc(p.title)}</li>`)
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#0f4fd8;border-radius:16px 16px 0 0;padding:28px 32px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px">KAEC <span style="font-weight:600;font-size:13px;opacity:.9">SCHOOL HEALTH CHECK</span></div>
      <div style="color:#dbeafe;font-size:13px;margin-top:6px">Your School Health Report is ready</div>
    </div>
    <div style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px">
      <p style="color:#0f172a;font-size:15px;margin:0 0 4px">Hello,</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 20px">
        The AI analysis of <strong>${esc(schoolName)}</strong> is complete. Here is your headline:
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:42px;font-weight:800;color:${rating.hex}">${report.overallScore}<span style="font-size:16px;color:#64748b;font-weight:500">/100</span></div>
        <div style="display:inline-block;background:${rating.hex}1a;color:${rating.hex};font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px;margin-top:6px">${esc(rating.label.toUpperCase())}</div>
        <div style="color:#475569;font-size:12px;margin-top:10px">Priority area: <strong>${esc(report.priorityArea)}</strong></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px"><tr>
        <td style="width:50%;vertical-align:top;padding-right:8px">
          <div style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.5px">Strengths</div>
          <ul style="padding-left:16px;margin:6px 0;font-size:13px">${strengths}</ul>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px">
          <div style="font-size:12px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:.5px">Priority areas</div>
          <ul style="padding-left:16px;margin:6px 0;font-size:13px">${priorities}</ul>
        </td>
      </tr></table>
      <a href="${reportUrl}" style="display:block;text-align:center;background:#0f4fd8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:12px">
        View Your Full Health Report
      </a>
      <p style="color:#64748b;font-size:12px;line-height:1.6;margin:18px 0 0">
        The full report includes department scores, area-by-area analysis, AI recommendations,
        a printable PDF download, and a sequenced 90-day improvement plan.
        You can also chat with the KAEC AI Coach about any finding directly from the report page.
      </p>
      <p style="color:#64748b;font-size:12px;margin:14px 0 0">Warm regards,<br><strong style="color:#0f172a">The KAEC Team</strong></p>
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:11px;padding:16px">
      KAEC School Health Check · Know the health of your school in minutes
    </div>
  </div>
</body></html>`;
}

export interface EmailResult {
  status: "sent" | "queued" | "failed";
  detail: string;
}

export async function sendReportEmail(
  to: string,
  schoolName: string,
  report: ReportData,
  reportUrl: string,
): Promise<EmailResult> {
  const subject = `Your KAEC School Health Report — ${schoolName} scored ${report.overallScore}/100 (${report.healthRating})`;
  const html = buildReportEmailHtml(schoolName, report, reportUrl);
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    await logEmail(to, subject, "queued", "No email provider configured (set RESEND_API_KEY to enable delivery).");
    return { status: "queued", detail: "queued (no provider configured)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "KAEC School Health <reports@kaec.education>",
        to: [to],
        subject,
        html,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      await logEmail(to, subject, "failed", `Resend ${res.status}: ${body.slice(0, 400)}`);
      return { status: "failed", detail: `provider error ${res.status}` };
    }
    await logEmail(to, subject, "sent", body.slice(0, 400));
    return { status: "sent", detail: "delivered via Resend" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logEmail(to, subject, "failed", msg.slice(0, 400));
    return { status: "failed", detail: msg };
  }
}
