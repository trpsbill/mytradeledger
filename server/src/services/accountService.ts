import prisma from '../db';
import { CreateAccountRequest, UpdateAccountRequest } from '../types';

export const accountService = {
  async findAll(includeArchived = false) {
    return prisma.account.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.account.findUnique({
      where: { id },
    });
  },

  async create(data: CreateAccountRequest) {
    return prisma.account.create({
      data: {
        name: data.name,
        baseCurrency: data.baseCurrency ?? 'USD',
      },
    });
  },

  async update(id: string, data: UpdateAccountRequest) {
    return prisma.account.update({
      where: { id },
      data,
    });
  },

  async archive(id: string) {
    return prisma.account.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  },

  async unarchive(id: string) {
    return prisma.account.update({
      where: { id },
      data: { archivedAt: null },
    });
  },

  async delete(id: string) {
    return prisma.account.delete({
      where: { id },
    });
  },

  async getBalance(accountId: string) {
    // Get sum of all ledger entries grouped by symbol
    const balances = await prisma.ledgerEntry.groupBy({
      by: ['symbol'],
      where: { accountId },
      _sum: { quantity: true },
    });

    return balances.map(b => ({
      symbol: b.symbol,
      quantity: b._sum.quantity,
    }));
  },

  async getPnL(accountId: string) {
    // Sum of all valueBase entries gives total P&L in base currency
    const result = await prisma.ledgerEntry.aggregate({
      where: { accountId },
      _sum: { valueBase: true },
    });

    return result._sum.valueBase ?? 0;
  },
};
