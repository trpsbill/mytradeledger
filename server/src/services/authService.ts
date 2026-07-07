import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';
import { authEmailGuard } from './emailSendGuard';

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MS ?? '') || 5 * 60 * 1000;
const SESSION_MAX_LIFETIME_MS = parseInt(process.env.SESSION_MAX_LIFETIME_MS ?? '') || 8 * 60 * 60 * 1000;

// Both reset and verification tokens are stored as SHA-256 hashes so a database
// leak does not expose usable links.
function hashToken(rawToken: string) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Issues a fresh verification token for a user and emails the link. Any prior
// unused tokens are invalidated first so only the latest link works. The send
// is fire-and-forget so a slow Mailjet round-trip never blocks the caller.
async function issueVerificationEmail(user: { id: string; email: string }) {
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  sendVerificationEmail(user, rawToken).catch((err) => {
    console.error('[email] verification send failed:', err?.message ?? err);
  });
}

export const authService = {
  async register(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new Error('EMAIL_IN_USE');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    // New accounts start unverified; send the confirmation link right away.
    // Token issuance is best-effort: the user row is already committed, so a
    // failure here (token DB write or email send) must NOT fail the overall
    // signup. We log it and return 201 — a missing verification email is fully
    // recoverable via the resendVerification flow.
    try {
      await issueVerificationEmail(user);
    } catch (err) {
      console.error(
        '[auth] verification token issuance failed during register (non-fatal):',
        (err as { message?: string })?.message ?? err
      );
    }

    return { user, token: signToken(user) };
  },

  async refreshSession(userId: string, loginAt: number | undefined) {
    if (loginAt !== undefined) {
      const sessionAgeMs = Date.now() - loginAt * 1000;
      if (sessionAgeMs > SESSION_MAX_LIFETIME_MS) {
        throw new Error('SESSION_MAX_LIFETIME_EXCEEDED');
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    return signToken(user, loginAt);
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return { user, token: signToken(user) };
  },

  async getById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
  },

  // Confirms the email address tied to a verification token. Idempotent for an
  // already-verified user: a valid-but-used token still resolves to success so
  // double-clicks on the email link don't surface a confusing error.
  async verifyEmail(token: string) {
    const record = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash: hashToken(token) },
    });

    if (!record) {
      throw new Error('INVALID_VERIFICATION_TOKEN');
    }

    if (record.usedAt) {
      // Already consumed — the address is verified, so treat as success. This is
      // checked before expiry so idempotency holds even after the token's 24h
      // lifetime: an already-verified user re-clicking an old link still lands on
      // success rather than a confusing "invalid or expired" error.
      return;
    }

    if (record.expiresAt < new Date()) {
      throw new Error('INVALID_VERIFICATION_TOKEN');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  },

  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Silently no-op for unknown accounts (no enumeration) or accounts that are
    // already verified (nothing to send).
    if (!user || user.emailVerifiedAt) {
      return;
    }

    // Same throttle/circuit-breaker as password reset: resend is an equally
    // abusable public send, and routing it through the shared guard keeps the
    // global auth-email ceiling honest. Suppression is silent (generic response).
    const decision = authEmailGuard.tryConsume(`verify:${user.email}`);
    if (!decision.allowed) {
      console.warn(`[email] verification resend suppressed by ${decision.reason} limit`);
      return;
    }

    await issueVerificationEmail(user);
  },

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Silently no-op when the account does not exist, to avoid enumeration.
    if (!user) {
      return;
    }

    // Throttle + circuit-break the actual email send behind the per-IP limiter:
    // a per-email cap stops a single inbox being mail-bombed from many IPs, and a
    // shared global ceiling caps total Mailjet spend/quota use. When suppressed we
    // skip the token write and the send but still return normally — the caller's
    // generic response is unchanged, so this leaks nothing about account state.
    const decision = authEmailGuard.tryConsume(`reset:${user.email}`);
    if (!decision.allowed) {
      console.warn(`[email] password reset send suppressed by ${decision.reason} limit`);
      return;
    }

    // Invalidate any prior unused tokens for this user.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // Fire-and-forget: do NOT await the send. Awaiting the Mailjet round-trip
    // only for existing accounts would make their response measurably slower,
    // leaking account existence via timing despite the generic 200 response.
    sendPasswordResetEmail(user, rawToken).catch((err) => {
      console.error('[email] password reset send failed:', err?.message ?? err);
    });
  },

  async purgeTokens() {
    const now = new Date();

    const [verificationDeleted, resetDeleted] = await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({
        where: {
          OR: [
            { usedAt: { not: null } },
            { expiresAt: { lt: now } },
          ],
        },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { usedAt: { not: null } },
            { expiresAt: { lt: now } },
          ],
        },
      }),
    ]);

    return {
      deletedVerificationTokens: verificationDeleted.count,
      deletedResetTokens: resetDeleted.count,
    };
  },

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new Error('INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  },
};

export function signToken(
  user: { id: string; email: string },
  loginAt?: number
) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      loginAt: loginAt ?? now,
    },
    process.env.JWT_SECRET!,
    { expiresIn: Math.floor(SESSION_IDLE_TIMEOUT_MS / 1000) }
  );
}
