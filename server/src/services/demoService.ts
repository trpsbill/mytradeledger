import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { calculateValueBase, toSignedQuantity } from './pnlCalculations';
import { ledgerService } from './ledgerService';

const DEMO_ACCOUNT_TTL_MS = parseInt(process.env.DEMO_ACCOUNT_TTL_MS ?? '') || 24 * 60 * 60 * 1000;

type DemoEntry = {
  symbol: string;
  entryType: 'BUY' | 'SELL';
  timestamp: Date;
  quantity: number;
  price: number;
  fee: number;
};

// Realistic crypto trades spanning Jan–May 2024.
// BTC/USD: avg cost ~$44,667 → sell at $67,000 → ~$9,333 gross gain
// ETH/USD: buy at $2,200 → sell at $3,800 → $1,600 gross gain
const DEMO_ENTRIES: DemoEntry[] = [
  { symbol: 'BTC/USD', entryType: 'BUY',  timestamp: new Date('2024-01-15T10:00:00Z'), quantity: 0.50, price: 42000, fee: 21.00 },
  { symbol: 'ETH/USD', entryType: 'BUY',  timestamp: new Date('2024-01-20T14:30:00Z'), quantity: 2.00, price: 2200,  fee: 4.40  },
  { symbol: 'BTC/USD', entryType: 'BUY',  timestamp: new Date('2024-02-20T09:15:00Z'), quantity: 0.25, price: 50000, fee: 12.50 },
  { symbol: 'BTC/USD', entryType: 'SELL', timestamp: new Date('2024-04-10T11:00:00Z'), quantity: 0.40, price: 67000, fee: 26.80 },
  { symbol: 'ETH/USD', entryType: 'SELL', timestamp: new Date('2024-05-15T13:20:00Z'), quantity: 1.00, price: 3800,  fee: 3.80  },
];

export const demoService = {
  async seedDemoAccount(userId: string) {
    const existing = await prisma.account.findFirst({ where: { userId, isDemo: true } });
    if (existing) return existing;

    const account = await prisma.account.create({
      data: { userId, name: 'Demo Portfolio', baseCurrency: 'USD', isDemo: true },
    });

    const entries = DEMO_ENTRIES.map(e => {
      const quantity = new Prisma.Decimal(e.quantity.toString());
      const price    = new Prisma.Decimal(e.price.toString());
      const fee      = new Prisma.Decimal(e.fee.toString());
      return {
        accountId: account.id,
        timestamp: e.timestamp,
        entryType: e.entryType,
        symbol:    e.symbol,
        quantity:  toSignedQuantity(e.entryType, quantity),
        price,
        fee,
        valueBase: calculateValueBase(e.entryType, quantity, price),
        pnl:       null,
        netPnl:    null,
        pnlStatus: null,
      };
    });

    await prisma.ledgerEntry.createMany({ data: entries });

    // Recompute P&L for each symbol in the demo account
    const uniqueSymbols = [...new Set(DEMO_ENTRIES.map(e => e.symbol))];
    for (const symbol of uniqueSymbols) {
      await prisma.$transaction(async (tx) => {
        await ledgerService.recomputeSymbolPnl(account.id, symbol, tx);
      });
    }

    return account;
  },

  // Creates a brand-new, isolated demo user for an anonymous visitor: no shared
  // credentials, own seeded portfolio, auto-expiring so cleanupExpiredDemoUsers
  // can reclaim it later.
  async createDemoUser() {
    const suffix = crypto.randomBytes(8).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `demo-${suffix}@demo.mytradeledger.local`,
        // Unusable, unguessable — demo users are only ever authenticated via the
        // JWT minted at creation time, never via the password login form.
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12),
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + DEMO_ACCOUNT_TTL_MS),
        emailVerifiedAt: new Date(),
      },
    });

    await this.seedDemoAccount(user.id);

    return user;
  },

  // Deletes demo users whose TTL has passed. Cascades (User -> Account ->
  // LedgerEntry -> LedgerMetadata, plus PersonalAccessToken/PasswordResetToken/
  // EmailVerificationToken) clean up all related rows in one call.
  async cleanupExpiredDemoUsers() {
    const { count } = await prisma.user.deleteMany({
      where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    });
    return { deletedDemoUsers: count };
  },

  // Immediately deletes a single demo user (called on logout, so we don't have
  // to wait for the TTL/scheduled sweep). The isDemo filter makes this a no-op
  // for a real user's id — safe to call unconditionally on their own userId.
  async deleteDemoUser(userId: string) {
    const { count } = await prisma.user.deleteMany({
      where: { id: userId, isDemo: true },
    });
    return { deleted: count > 0 };
  },
};
