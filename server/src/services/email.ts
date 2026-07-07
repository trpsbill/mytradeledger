import Mailjet from 'node-mailjet';

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

// Warn (but do not crash) when the Mailjet configuration is incomplete. With
// MJ_SANDBOX=true, sends are short-circuited to the console so this is fine in dev.
if (
  !process.env.MJ_APIKEY_PUBLIC ||
  !process.env.MJ_APIKEY_PRIVATE ||
  !process.env.MJ_FROM_EMAIL
) {
  console.warn(
    '[email] Mailjet is not fully configured (MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE, MJ_FROM_EMAIL). ' +
      'Real sends will fail unless MJ_SANDBOX=true.'
  );
}

// Construct the Mailjet client lazily: its constructor throws when the API keys
// are missing, so building it at module load would crash the server even though
// sandbox mode needs no credentials.
let mailjetClient: Mailjet | null = null;
function getMailjet(): Mailjet {
  if (!mailjetClient) {
    mailjetClient = new Mailjet({
      apiKey: process.env.MJ_APIKEY_PUBLIC,
      apiSecret: process.env.MJ_APIKEY_PRIVATE,
    });
  }
  return mailjetClient;
}

/**
 * Sends an email via Mailjet's Send API v3.1. When MJ_SANDBOX=true the email is
 * logged to the console instead of being sent, which keeps the password-reset
 * token flow testable without delivering real mail.
 */
export async function sendEmail({ to, toName, subject, text, html, replyTo }: SendEmailParams): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[email] sendEmail', { to, subject });

  if (process.env.MJ_SANDBOX === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[email] --- sandbox, not sending. text body for ${to} ---\n${text}`);
    return;
  }

  try {
    await getMailjet().post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: process.env.MJ_FROM_EMAIL, Name: process.env.MJ_FROM_NAME },
          To: [{ Email: to, Name: toName ?? to }],
          ...(replyTo ? { ReplyTo: { Email: replyTo } } : {}),
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    });
  } catch (err: unknown) {
    console.error('[email] Mailjet send failed', err);
    throw err;
  }
}

/**
 * Sends a password reset email containing a link with the raw reset token.
 */
export async function sendPasswordResetEmail(
  user: { email: string },
  rawToken: string
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const link = `${baseUrl}/reset-password?token=${rawToken}`;

  const text = [
    'Hi there,',
    '',
    'We received a request to reset the password for your MyTradeLedger account.',
    '',
    'Click the link below to create a new password. This link will expire in 1 hour:',
    link,
    '',
    "If you didn't request this, you can safely ignore this email—your account will remain secure, and no changes will be made.",
    '',
    'Best regards,',
    'The MyTradeLedger Team',
  ].join('\n');

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e8ed;">
          <tr>
            <td style="background-color:#570df8;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold;">
              MyTradeLedger
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1f2933;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hi there,</p>
              <p style="margin:0 0 16px;">We received a request to reset the password for your MyTradeLedger account.</p>
              <p style="margin:0 0 24px;">Click the button below to create a new password. This link will expire in 1 hour.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#570df8;">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">Reset My Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#52606d;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#570df8;">${link}</a></p>
              <p style="margin:0 0 24px;color:#52606d;">If you didn't request this, you can safely ignore this email—your account will remain secure, and no changes will be made.</p>
              <p style="margin:0;">Best regards,<br>The MyTradeLedger Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Reset your MyTradeLedger password',
    text,
    html,
  });
}

/**
 * Forwards a user-submitted support request to support@mytradeledger.com,
 * with Reply-To set to the submitting user's email so staff can reply directly.
 */
export async function sendSupportEmail({
  fromEmail,
  userId,
  subject,
  message,
}: {
  fromEmail: string;
  userId: string;
  subject: string;
  message: string;
}): Promise<void> {
  function esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const text = [
    `From: ${fromEmail}`,
    '',
    message,
    '',
    '---',
    'User Info',
    `ID: ${userId}`,
  ].join('\n');

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e8ed;">
          <tr>
            <td style="background-color:#570df8;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:bold;">
              MyTradeLedger — Support Request
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#1f2933;font-size:15px;line-height:1.6;">
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e8e8ed;border-bottom:1px solid #e8e8ed;margin:0 0 20px;">
                <tr>
                  <td style="padding:8px 0;color:#52606d;font-size:13px;white-space:nowrap;vertical-align:top;width:72px;">From</td>
                  <td style="padding:8px 0 8px 16px;font-size:14px;">${esc(fromEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#52606d;font-size:13px;vertical-align:top;">Subject</td>
                  <td style="padding:8px 0 8px 16px;font-size:14px;font-weight:bold;">${esc(subject)}</td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#52606d;font-weight:bold;">Message</p>
              <p style="margin:0 0 24px;white-space:pre-wrap;font-size:14px;">${esc(message)}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#52606d;font-weight:bold;">User Info</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e8e8ed;border-bottom:1px solid #e8e8ed;">
                <tr>
                  <td style="padding:8px 0;color:#52606d;font-size:13px;white-space:nowrap;vertical-align:top;width:72px;">ID</td>
                  <td style="padding:8px 0 8px 16px;font-size:14px;font-family:monospace;">${esc(userId)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;

  await sendEmail({
    to: 'support@mytradeledger.com',
    toName: 'MyTradeLedger Support',
    subject: `[Support] ${subject}`,
    text,
    html,
    replyTo: fromEmail,
  });
}

/**
 * Sends an email-verification message containing a link with the raw token.
 */
export async function sendVerificationEmail(
  user: { email: string },
  rawToken: string
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const link = `${baseUrl}/verify-email?token=${rawToken}`;

  const text = [
    'Welcome to MyTradeLedger!',
    '',
    "Please confirm your email address to finish setting up your account.",
    '',
    'Click the link below to verify your email. This link will expire in 24 hours:',
    link,
    '',
    "If you didn't create a MyTradeLedger account, you can safely ignore this email.",
    '',
    'Best regards,',
    'The MyTradeLedger Team',
  ].join('\n');

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e8ed;">
          <tr>
            <td style="background-color:#570df8;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:bold;">
              MyTradeLedger
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1f2933;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Welcome to MyTradeLedger!</p>
              <p style="margin:0 0 16px;">Please confirm your email address to finish setting up your account.</p>
              <p style="margin:0 0 24px;">Click the button below to verify your email. This link will expire in 24 hours.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#570df8;">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">Verify My Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#52606d;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#570df8;">${link}</a></p>
              <p style="margin:0 0 24px;color:#52606d;">If you didn't create a MyTradeLedger account, you can safely ignore this email.</p>
              <p style="margin:0;">Best regards,<br>The MyTradeLedger Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Verify your MyTradeLedger email',
    text,
    html,
  });
}
