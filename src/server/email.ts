import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendActivationOptions {
  to: string;
  name?: string;
  token: string;
  req?: any;
}

export interface EmailResult {
  success: boolean;
  simulated?: boolean;
  error?: string;
  activationUrl: string;
}

/**
 * Sends an activation email via Resend API.
 * If RESEND_API_KEY is not configured, logs a simulated activation message for development/testing.
 */
export async function sendActivationEmail(options: SendActivationOptions): Promise<EmailResult> {
  const { to, name = 'Operator', token, req } = options;

  // Resolve base application URL
  let baseUrl = (process.env.APP_URL || '').trim();
  if (!baseUrl && req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    if (host) {
      baseUrl = `${proto}://${host}`;
    }
  }
  if (!baseUrl) {
    baseUrl = 'http://localhost:3000';
  }
  // Ensure no trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  const activationUrl = `${baseUrl}/?activateToken=${encodeURIComponent(token)}`;
  const directApiUrl = `${baseUrl}/api/auth/activate?token=${encodeURIComponent(token)}`;

  const resend = getResendClient();

  if (!resend) {
    console.warn(
      `[RESEND] No RESEND_API_KEY detected. Simulated activation email for "${to}".\n` +
      `[RESEND] Direct activation link: ${activationUrl}\n` +
      `[RESEND] Token: ${token}`
    );
    return {
      success: true,
      simulated: true,
      activationUrl,
    };
  }

  const fromEmail = (process.env.RESEND_FROM_EMAIL || '').trim() || 'Scambaiter Ops <onboarding@resend.dev>';
  const subject = 'Activate your Scambaiter CRM account';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Activate Your Account</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px 28px; text-align: center; border-bottom: 1px solid #374151; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #064e3b; color: #34d399; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 9999px; margin-bottom: 12px; }
    .title { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 32px 28px; line-height: 1.6; color: #cbd5e1; font-size: 15px; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); }
    .token-box { background-color: #0d1322; border: 1px dashed #374151; border-radius: 8px; padding: 14px; margin: 20px 0; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #93c5fd; text-align: center; }
    .footer { padding: 24px 28px; background-color: #0a0e17; border-top: 1px solid #1f2937; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">CookieBait Ops • Security Clearance</div>
      <h1 class="title">Account Activation Required</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>Your operator account for <strong>Scambaiter CRM</strong> has been registered. Before accessing the real-time scammer pipeline, call logs, and fraud tracking database, please verify your email address to activate your access.</p>
      
      <div class="btn-container">
        <a href="${activationUrl}" class="btn" target="_blank">Activate My Account</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">Or paste this link into your browser:</p>
      <div class="token-box">
        <a href="${activationUrl}" style="color: #60a5fa; text-decoration: none;">${activationUrl}</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8;">You can also enter your activation token manually in the portal:</p>
      <div class="token-box" style="letter-spacing: 0.05em; font-weight: 600; color: #38bdf8;">
        ${token}
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This activation link is valid for <strong>24 hours</strong>. If you did not create this account, please safely disregard this email.</p>
    </div>
    <div class="footer">
      <p>Scambaiter CRM — Counter-Fraud & Anti-Scam Operations Center</p>
      <p>Automated verification notification • Please do not reply directly to this message</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[RESEND] API returned an error:', error);
      return {
        success: false,
        error: error.message || 'Resend delivery failure',
        activationUrl,
      };
    }

    console.log(`[RESEND] Activation email successfully sent to ${to} (Message ID: ${data?.id})`);
    return {
      success: true,
      activationUrl,
    };
  } catch (err: any) {
    console.error('[RESEND] Exception sending activation email:', err);
    return {
      success: false,
      error: err?.message || 'Network exception calling Resend API',
      activationUrl,
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
