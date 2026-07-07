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
 * Notifies the customer that their payment failed and prompts them to update billing.
 */
export async function sendPaymentFailedEmail(
  user: { email: string },
  portalUrl: string
): Promise<void> {
  const text = [
    'Your MyTradeLedger payment failed.',
    '',
    'We were unable to process the payment for your Pro subscription. Please update your payment method to avoid any interruption to your Pro access.',
    '',
    'To update your payment method, click the link below:',
    portalUrl,
    '',
    'If you have any questions, just reply to this email.',
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
              <p style="margin:0 0 16px;">We were unable to process the payment for your Pro subscription.</p>
              <p style="margin:0 0 16px;">Please update your payment method to avoid any interruption to your Pro access.</p>
              <p style="margin:0 0 24px;color:#52606d;">Update your payment method using the button below. It only takes a moment.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#570df8;">
                    <a href="${portalUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">Update Payment Method</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#52606d;font-size:13px;">If you believe this is an error or have any questions, just reply to this email.</p>
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
    subject: 'Action required: your MyTradeLedger payment failed',
    text,
    html,
  });
}

/**
 * Sends a subscription confirmation email after a successful Stripe checkout.
 */
export async function sendSubscriptionConfirmationEmail(
  user: { email: string }
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const accountUrl = `${baseUrl}/app/settings/account`;

  const text = [
    'Welcome to MyTradeLedger Pro!',
    '',
    "You're now subscribed — thank you for your support.",
    '',
    'Your account has been upgraded and you now have:',
    '  - Unlimited trades',
    '  - Full P&L tracking',
    '  - CSV export',
    '  - API access',
    '',
    'You can manage your subscription at any time from your account page:',
    accountUrl,
    '',
    'If you have any questions, just reply to this email.',
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
              <p style="margin:0 0 16px;">Welcome to MyTradeLedger Pro!</p>
              <p style="margin:0 0 16px;">You're now subscribed — thank you for your support. Your account has been upgraded with full Pro access.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f4f4f7;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-weight:bold;font-size:14px;">What's included:</p>
                    <p style="margin:0 0 4px;font-size:14px;">&#10003; Unlimited trades</p>
                    <p style="margin:0 0 4px;font-size:14px;">&#10003; Full P&amp;L tracking</p>
                    <p style="margin:0 0 4px;font-size:14px;">&#10003; CSV export</p>
                    <p style="margin:0;font-size:14px;">&#10003; API access</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#570df8;">
                    <a href="${accountUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">View My Account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#52606d;font-size:13px;">You can manage or cancel your subscription at any time from your account page.</p>
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
    subject: 'You\'re now a MyTradeLedger Pro member!',
    text,
    html,
  });
}

/**
 * Sends a subscription cancellation confirmation email.
 */
export async function sendSubscriptionCancellationEmail(
  user: { email: string },
  reason?: string
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const upgradeUrl = `${baseUrl}/app/settings/account`;

  const reasonBlock = reason
    ? `\nYou told us: "${reason}"\nThis helps us improve — thank you for the feedback.\n`
    : '';

  const text = [
    'Your MyTradeLedger subscription has been cancelled.',
    '',
    'You still have Pro access until the end of your current billing period. After that your account reverts to the free plan (25-trade limit).',
    reasonBlock,
    "If you change your mind, you can resubscribe at any time:",
    upgradeUrl,
    '',
    'If you have any questions or feedback, just reply to this email.',
    '',
    'Best regards,',
    'The MyTradeLedger Team',
  ].join('\n');

  const reasonHtml = reason
    ? `<div style="background-color:#f4f4f7;border-left:3px solid #9b59b6;border-radius:0 4px 4px 0;padding:12px 16px;margin:0 0 16px;font-size:14px;color:#52606d;">
        <p style="margin:0 0 4px;font-weight:bold;">Your feedback:</p>
        <p style="margin:0;">${reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#7b8794;">Thank you — this helps us improve.</p>
      </div>`
    : '';

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
              <p style="margin:0 0 16px;">Your subscription has been cancelled.</p>
              <p style="margin:0 0 16px;">You still have Pro access until the end of your current billing period. After that your account reverts to the free plan.</p>
              ${reasonHtml}
              <p style="margin:0 0 24px;color:#52606d;">We're sorry to see you go. If you change your mind, you can resubscribe at any time.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#570df8;">
                    <a href="${upgradeUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">Resubscribe</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#52606d;font-size:13px;">If you have any questions or concerns, just reply to this email — we're happy to help.</p>
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
    subject: 'Your MyTradeLedger subscription has been cancelled',
    text,
    html,
  });
}

/**
 * Notifies the admin of a subscription cancellation.
 */
export async function sendCancellationAdminNotification(
  user: { email: string },
  reason?: string
): Promise<void> {
  const ADMIN_EMAIL = process.env.BILLING_ADMIN_EMAIL || 'billw@mytradeledger.com';
  const timestamp = new Date().toUTCString();
  const reasonLine = reason ? `Reason: ${reason}` : 'Reason: (none provided)';

  const text = [
    'Subscription cancellation',
    '',
    `Customer: ${user.email}`,
    reasonLine,
    `Time: ${timestamp}`,
  ].join('\n');

  const reasonHtml = reason
    ? `<tr><td style="padding:6px 0;color:#52606d;font-size:14px;">Reason</td><td style="padding:6px 0 6px 16px;font-size:14px;">${reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>`
    : `<tr><td style="padding:6px 0;color:#52606d;font-size:14px;">Reason</td><td style="padding:6px 0 6px 16px;font-size:14px;color:#9b9b9b;">(none provided)</td></tr>`;

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e8ed;">
          <tr>
            <td style="background-color:#dc2626;padding:16px 32px;color:#ffffff;font-size:16px;font-weight:bold;">
              MyTradeLedger — Cancellation Alert
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#1f2933;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 20px;">A subscriber has cancelled their subscription.</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e8e8ed;border-bottom:1px solid #e8e8ed;margin:0 0 20px;">
                <tr><td style="padding:6px 0;color:#52606d;font-size:14px;">Customer</td><td style="padding:6px 0 6px 16px;font-size:14px;">${user.email}</td></tr>
                ${reasonHtml}
                <tr><td style="padding:6px 0;color:#52606d;font-size:14px;">Time</td><td style="padding:6px 0 6px 16px;font-size:14px;">${timestamp}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;

  await sendEmail({
    to: ADMIN_EMAIL,
    toName: 'Bill W',
    subject: `Cancellation: ${user.email}`,
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
