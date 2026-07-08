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
 * Forwards a user-submitted support request to SUPPORT_EMAIL (the operator's
 * own inbox — configure this to your own address), with Reply-To set to the
 * submitting user's email so you can reply directly.
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
    to: process.env.SUPPORT_EMAIL || process.env.MJ_FROM_EMAIL || 'support@example.com',
    toName: 'MyTradeLedger Support',
    subject: `[Support] ${subject}`,
    text,
    html,
    replyTo: fromEmail,
  });
}
