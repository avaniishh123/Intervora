/**
 * emailService — Sends interview invite emails via nodemailer.
 * Falls back to console-log when SMTP is not configured (dev mode).
 */
import nodemailer from 'nodemailer';

interface InviteEmailOptions {
  to: string;
  candidateName: string;
  hostName: string;
  jobRole: string;
  joinUrl: string;
  durationMinutes: number;
  expiresAt: Date;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Dev fallback — log to console
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendInterviewInvite(opts: InviteEmailOptions): Promise<void> {
  const transporter = createTransporter();

  const expiryStr = opts.expiresAt.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">🎯 Interview Invitation</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">You've been invited to a live interview session</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#2d3748;font-size:16px;margin:0 0 20px;">Hi <strong>${opts.candidateName}</strong>,</p>
            <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px;">
              <strong>${opts.hostName}</strong> has invited you to a live interview for the
              <strong>${opts.jobRole}</strong> position. The session will last approximately
              <strong>${opts.durationMinutes} minutes</strong>.
            </p>

            <div style="background:#f7fafc;border-radius:10px;padding:20px 24px;margin:0 0 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#718096;font-size:13px;padding:4px 0;">Role</td>
                  <td style="color:#2d3748;font-size:14px;font-weight:600;text-align:right;">${opts.jobRole}</td>
                </tr>
                <tr>
                  <td style="color:#718096;font-size:13px;padding:4px 0;">Duration</td>
                  <td style="color:#2d3748;font-size:14px;font-weight:600;text-align:right;">${opts.durationMinutes} minutes</td>
                </tr>
                <tr>
                  <td style="color:#718096;font-size:13px;padding:4px 0;">Link expires</td>
                  <td style="color:#e53e3e;font-size:13px;font-weight:600;text-align:right;">${expiryStr}</td>
                </tr>
              </table>
            </div>

            <div style="text-align:center;margin:0 0 28px;">
              <a href="${opts.joinUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                Join Interview →
              </a>
            </div>

            <div style="background:#fffbeb;border:1px solid #f6e05e;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
              <p style="color:#744210;font-size:13px;margin:0;line-height:1.5;">
                ⚠️ <strong>Important:</strong> This link is unique to you and expires on ${expiryStr}.
                Please allow camera and microphone access when prompted.
              </p>
            </div>

            <p style="color:#a0aec0;font-size:12px;margin:0;line-height:1.5;">
              If you cannot click the button, copy this link into your browser:<br>
              <span style="color:#667eea;word-break:break-all;">${opts.joinUrl}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f7fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#a0aec0;font-size:12px;margin:0;">
              Sent by Intervora · AI-Powered Interview Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `
Interview Invitation — ${opts.jobRole}

Hi ${opts.candidateName},

${opts.hostName} has invited you to a live interview for the ${opts.jobRole} position.
Duration: ${opts.durationMinutes} minutes
Link expires: ${expiryStr}

Join here: ${opts.joinUrl}

Please allow camera and microphone access when prompted.
`;

  if (!transporter) {
    // Dev mode — print to console
    console.log('\n📧 [EMAIL SERVICE — DEV MODE] Interview invite would be sent:');
    console.log(`  To: ${opts.to}`);
    console.log(`  Subject: Interview Invitation — ${opts.jobRole}`);
    console.log(`  Join URL: ${opts.joinUrl}`);
    console.log(`  Expires: ${expiryStr}\n`);
    return;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@intervora.app';

  await transporter.sendMail({
    from: `"Intervora Interviews" <${from}>`,
    to: opts.to,
    subject: `Interview Invitation — ${opts.jobRole} with ${opts.hostName}`,
    text,
    html,
  });

  console.log(`✅ Interview invite sent to ${opts.to}`);
}
