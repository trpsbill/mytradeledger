import crypto from 'crypto';
import prisma from '../db';
import type { AuthUser } from '../middleware/auth';

const TOKEN_PREFIX = 'mtl_';

const SAFE_SELECT = {
  id: true,
  userId: true,
  name: true,
  tokenPrefix: true,
  lastFourChars: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
} as const;

export const tokenService = {
  async list(userId: string) {
    return prisma.personalAccessToken.findMany({
      where: { userId },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(userId: string, name: string, expiresAt?: Date) {
    const rawToken = TOKEN_PREFIX + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const lastFourChars = rawToken.slice(-4);

    const pat = await prisma.personalAccessToken.create({
      data: {
        userId,
        name,
        tokenHash,
        tokenPrefix: TOKEN_PREFIX,
        lastFourChars,
        expiresAt: expiresAt ?? null,
      },
      select: SAFE_SELECT,
    });

    return { token: rawToken, ...pat };
  },

  async revoke(id: string, userId: string): Promise<boolean> {
    const pat = await prisma.personalAccessToken.findFirst({
      where: { id, userId },
    });
    if (!pat) return false;
    await prisma.personalAccessToken.delete({ where: { id } });
    return true;
  },

  async validate(rawToken: string): Promise<AuthUser | null> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pat = await prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!pat) return null;
    if (pat.expiresAt && pat.expiresAt < new Date()) return null;

    prisma.personalAccessToken
      .update({ where: { id: pat.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return { userId: pat.user.id, email: pat.user.email };
  },
};
