import { Prisma } from '@prisma/client';
import prisma from '../db';
import { CreateAccountRequest, UpdateAccountRequest } from '../types';
import { computeOpenPositionCostBasis } from './pnlCalculations';

export const accountService = {
  async findAll(userId: string, includeArchived = false) {
    return prisma.account.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string, userId: string) {
    return prisma.account.findFirst({
      where: { id, userId },
    });
  },

  async create(userId: string, data: CreateAccountRequest) {
    return prisma.$transaction(async (tx) => {
      const existingCount = await tx.account.count({ where: { userId } });
      return tx.account.create({
        data: {
          userId,
          name: data.name,
          baseCurrency: data.baseCurrency ?? 'USD',
          isDefault: existingCount === 0,
        },
      });
    });
  },

  async setDefault(id: string, userId: string) {
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return null;
    await prisma.$transaction(async (tx) => {
      await tx.account.updateMany({ where: { userId }, data: { isDefault: false } });
      await tx.account.update({ where: { id }, data: { isDefault: true } });
    });
    return prisma.account.findUnique({ where: { id } });
  },

  async update(id: string, userId: string, data: UpdateAccountRequest) {
    return prisma.account.updateMany({
      where: { id, userId },
      data,
    });
  },

  async archive(id: string, userId: string) {
    return prisma.account.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  },

  async unarchive(id: string, userId: string) {
    return prisma.account.updateMany({
      where: { id, userId },
      data: { archivedAt: null },
    });
  },

  async delete(id: string, userId: string) {
    return prisma.account.deleteMany({
      where: { id, userId },
    });
  },

  async getBalance(accountId: string, userId: string) {
    const account = await this.findById(accountId, userId);
    if (!account) return null;

    const quantitySums = await prisma.ledgerEntry.groupBy({
      by: ['symbol'],
      where: { accountId },
      _sum: { quantity: true },
    });

    // Filter to open positions only (positive remaining quantity)
    const openPositions = quantitySums.filter(
      b => b._sum.quantity && b._sum.quantity.gt(0),
    );

    if (openPositions.length === 0) return [];

    const openSymbols = openPositions.map(b => b.symbol);

    // Fetch all BUY/SELL entries for open symbols in a single query
    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        accountId,
        symbol: { in: openSymbols },
        entryType: { in: ['BUY', 'SELL'] },
      },
      select: {
        id: true,
        entryType: true,
        symbol: true,
        quantity: true,
        price: true,
        timestamp: true,
        createdAt: true,
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
    });

    // Group entries by symbol
    const entriesBySymbol = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      if (!entriesBySymbol.has(entry.symbol)) {
        entriesBySymbol.set(entry.symbol, []);
      }
      entriesBySymbol.get(entry.symbol)!.push(entry);
    }

    return openPositions.map(b => ({
      symbol: b.symbol,
      quantity: b._sum.quantity!,
      costBasis: computeOpenPositionCostBasis(entriesBySymbol.get(b.symbol) ?? []),
    }));
  },

  async getPnL(accountId: string, userId: string) {
    const account = await this.findById(accountId, userId);
    if (!account) return null;

    const [sellResult, feeResult, uncomputableCount] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { accountId, entryType: 'SELL' },
        _sum: { pnl: true, netPnl: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { accountId },
        _sum: { fee: true },
      }),
      prisma.ledgerEntry.count({
        where: { accountId, entryType: 'SELL', pnlStatus: 'PNL_UNCOMPUTABLE' },
      }),
    ]);

    const totalPnL    = sellResult._sum.pnl    ?? new Prisma.Decimal(0);
    const totalNetPnL = sellResult._sum.netPnl ?? new Prisma.Decimal(0);
    const totalFees   = feeResult._sum.fee     ?? new Prisma.Decimal(0);

    return { account, totalPnL, totalNetPnL, totalFees, uncomputableCount };
  },
};
