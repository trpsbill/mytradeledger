import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db';

const SALT_ROUNDS = 12;
const SESSION_IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MS ?? '') || 5 * 60 * 1000;
const SESSION_MAX_LIFETIME_MS = parseInt(process.env.SESSION_MAX_LIFETIME_MS ?? '') || 8 * 60 * 60 * 1000;

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
        createdAt: true,
      },
    });
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
