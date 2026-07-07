import { Prisma } from '@prisma/client';
import prisma from '../db';
import { CreateLedgerEntryRequest, UpdateLedgerEntryRequest, LedgerQueryParams } from '../types';
import {
  calculateAverageCost,
  calculateNetAverageCost,
  calculateValueBase,
  toSignedQuantity,
  computeSellPnlResult,
  computeRunningPnl,
} from './pnlCalculations';

const DEFAULT_ACCOUNT_NAME = 'Default';

export const ledgerService = {
  // Export ledger entries to CSV format
  async exportToCsv(userId: string, params: LedgerQueryParams = {}) {
    const { entries } = await this.findAll({ ...params, userId, limit: 10000 });

    const headers = ['Date', 'Type', 'Symbol', 'Quantity', 'Price', 'Fee', 'Total', 'P&L', 'Notes'];
    const rows = entries.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.entryType,
      entry.symbol,
      entry.quantity.toString(),
      entry.price.toString(),
      entry.fee?.toString() || '',
      entry.valueBase.toString(),
      entry.pnl?.toString() || '',
      entry.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  },

  // Recompute P&L for all SELL entries in a single (accountId, symbol) pair.
  // Uses the provided transaction client so writes are consistent with in-flight changes.
  async recomputeSymbolPnl(
    accountId: string,
    symbol: string,
    tx: Prisma.TransactionClient,
  ) {
    const allEntries = await tx.ledgerEntry.findMany({
      where: { accountId, symbol, entryType: { in: ['BUY', 'SELL'] } },
      select: { id: true, entryType: true, quantity: true, price: true, fee: true, timestamp: true, createdAt: true },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
    });

    const pnlMap = computeRunningPnl(allEntries);

    for (const [id, { pnl, netPnl, pnlStatus }] of pnlMap) {
      await tx.ledgerEntry.update({
        where: { id },
        data: { pnl, netPnl, pnlStatus },
      });
    }
  },

  // Recalculate P&L for all SELL entries belonging to this user.
  // Processes each unique (accountId, symbol) pair in its own transaction
  // so results are identical to the per-write auto-recompute path.
  async recalculateAllPnL(userId: string) {
    const sellEntries = await prisma.ledgerEntry.findMany({
      where: { entryType: 'SELL', account: { userId } },
      select: { accountId: true, symbol: true },
    });

    // Deduplicate to unique (accountId, symbol) pairs
    const pairSet = new Map<string, { accountId: string; symbol: string }>();
    for (const e of sellEntries) {
      pairSet.set(`${e.accountId}|${e.symbol}`, { accountId: e.accountId, symbol: e.symbol });
    }

    for (const { accountId, symbol } of pairSet.values()) {
      await prisma.$transaction(async (tx) => {
        await this.recomputeSymbolPnl(accountId, symbol, tx);
      });
    }

    return { updated: sellEntries.length };
  },

  // Gross average cost basis (fees excluded). asOf filters to buys with timestamp <= asOf.
  async getAverageCost(accountId: string, symbol: string, asOf?: Date): Promise<Prisma.Decimal | null> {
    const buyEntries = await prisma.ledgerEntry.findMany({
      where: {
        accountId,
        symbol,
        entryType: 'BUY',
        ...(asOf ? { timestamp: { lte: asOf } } : {}),
      },
      select: { quantity: true, price: true },
    });
    return calculateAverageCost(buyEntries);
  },

  // Net average cost basis (buy fees folded in). asOf filters to buys with timestamp <= asOf.
  async getNetAverageCost(accountId: string, symbol: string, asOf?: Date): Promise<Prisma.Decimal | null> {
    const buyEntries = await prisma.ledgerEntry.findMany({
      where: {
        accountId,
        symbol,
        entryType: 'BUY',
        ...(asOf ? { timestamp: { lte: asOf } } : {}),
      },
      select: { quantity: true, price: true, fee: true },
    });
    return calculateNetAverageCost(buyEntries);
  },

  async getSellPnl(
    accountId: string,
    symbol: string,
    sellQty: Prisma.Decimal,
    sellPrice: Prisma.Decimal,
    sellFee: Prisma.Decimal | null,
    asOf: Date,
  ) {
    const buyEntries = await prisma.ledgerEntry.findMany({
      where: { accountId, symbol, entryType: 'BUY', timestamp: { lte: asOf } },
      select: { quantity: true, price: true, fee: true },
    });
    return computeSellPnlResult(buyEntries, sellQty, sellPrice, sellFee);
  },

  // Get or create the default account for a user
  async getDefaultAccount(userId: string) {
    let account = await prisma.account.findFirst({
      where: { userId, isDefault: true },
    });

    if (!account) {
      // Fallback: find/create the legacy "Default" account and mark it as default
      account = await prisma.account.findFirst({
        where: { userId, name: DEFAULT_ACCOUNT_NAME },
      });

      if (!account) {
        account = await prisma.account.create({
          data: { userId, name: DEFAULT_ACCOUNT_NAME, isDefault: true },
        });
      } else {
        account = await prisma.account.update({
          where: { id: account.id },
          data: { isDefault: true },
        });
      }
    }

    return account;
  },

  async findAll(params: LedgerQueryParams = {}) {
    const { userId, accountId, symbol, entryType, startDate, endDate, limit = 100, offset = 0 } = params;

    const where: Prisma.LedgerEntryWhereInput = {};

    if (accountId) {
      // Scope to a specific account; still validate userId ownership via the relation
      where.accountId = accountId;
      if (userId) where.account = { userId };
    } else if (userId) {
      where.account = { userId };
    }
    if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };
    if (entryType) where.entryType = entryType;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: { account: true },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return { entries, total, limit, offset };
  },

  async findById(id: string, userId?: string) {
    return prisma.ledgerEntry.findFirst({
      where: {
        id,
        ...(userId ? { account: { userId } } : {}),
      },
      include: {
        account: true,
        metadata: true,
      },
    });
  },

  async create(userId: string, data: CreateLedgerEntryRequest) {
    let account;
    if (data.accountId) {
      account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
      if (!account) throw new Error('Account not found');
    } else {
      // No accountId provided — find the user's real (non-demo, non-archived) accounts.
      // Use the sole account directly to avoid creating a phantom "Default" account.
      const realAccounts = await prisma.account.findMany({
        where: { userId, isDemo: false, archivedAt: null },
        select: { id: true },
        take: 2,
      });
      if (realAccounts.length === 1) {
        account = await prisma.account.findUniqueOrThrow({ where: { id: realAccounts[0].id } });
      } else if (realAccounts.length > 1) {
        throw new Error('accountId is required when multiple accounts exist');
      } else {
        account = await this.getDefaultAccount(userId);
      }
    }

    const quantity = new Prisma.Decimal(data.quantity.toString());
    const price = new Prisma.Decimal(data.price.toString());
    const fee = data.fee != null ? new Prisma.Decimal(data.fee.toString()) : null;
    const entryTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    const valueBase = calculateValueBase(data.entryType as 'BUY' | 'SELL', quantity, price);
    const signedQuantity = toSignedQuantity(data.entryType as 'BUY' | 'SELL', quantity);

    return prisma.$transaction(async (tx) => {
      const created = await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          timestamp: entryTimestamp,
          entryType: data.entryType,
          symbol: data.symbol,
          quantity: signedQuantity,
          price,
          fee,
          valueBase,
          pnl: null,
          netPnl: null,
          pnlStatus: null,
          notes: data.notes,
        },
      });

      // Recompute all SELLs for this (account, symbol) — includes the new entry if it's a SELL,
      // and updates existing SELLs whose cost basis changed if it's a BUY.
      await this.recomputeSymbolPnl(account.id, data.symbol, tx);

      return tx.ledgerEntry.findFirstOrThrow({
        where: { id: created.id },
        include: { account: true },
      });
    });
  },

  async createMany(userId: string, entries: CreateLedgerEntryRequest[]) {
    const account = await this.getDefaultAccount(userId);

    const data = entries.map(entry => {
      const quantity = new Prisma.Decimal(entry.quantity.toString());
      const price = new Prisma.Decimal(entry.price.toString());
      const rawValue = quantity.abs().mul(price);
      const valueBase = entry.entryType === 'BUY' ? rawValue.neg() : rawValue;
      const signedQuantity = entry.entryType === 'SELL' ? quantity.abs().neg() : quantity.abs();

      return {
        accountId: account.id,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
        entryType: entry.entryType,
        symbol: entry.symbol,
        quantity: signedQuantity,
        price: price,
        fee: entry.fee != null ? new Prisma.Decimal(entry.fee.toString()) : null,
        valueBase: valueBase,
        notes: entry.notes,
      };
    });

    return prisma.ledgerEntry.createMany({ data });
  },

  async update(id: string, userId: string, data: UpdateLedgerEntryRequest) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id, account: { userId } },
    });
    if (!existing) throw new Error('Entry not found');

    // Validate new account ownership if moving the entry
    if (data.accountId && data.accountId !== existing.accountId) {
      const newAccount = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
      if (!newAccount) throw new Error('Account not found');
    }

    const updateData: Prisma.LedgerEntryUpdateInput = {};

    if (data.timestamp) updateData.timestamp = new Date(data.timestamp);
    if (data.entryType) updateData.entryType = data.entryType;
    if (data.symbol) updateData.symbol = data.symbol;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.fee !== undefined) {
      updateData.fee = data.fee != null ? new Prisma.Decimal(data.fee.toString()) : null;
    }
    if (data.accountId) {
      updateData.account = { connect: { id: data.accountId } };
    }

    const quantity = data.quantity !== undefined
      ? new Prisma.Decimal(data.quantity.toString())
      : existing.quantity;
    const price = data.price !== undefined
      ? new Prisma.Decimal(data.price.toString())
      : existing.price;
    const entryType = data.entryType || existing.entryType;

    if (data.quantity !== undefined || data.price !== undefined || data.entryType) {
      updateData.valueBase = calculateValueBase(entryType as 'BUY' | 'SELL', quantity, price);
      updateData.quantity = toSignedQuantity(entryType as 'BUY' | 'SELL', quantity);
      updateData.price = price;
    }

    // Zero out P&L before recompute — recomputeSymbolPnl sets correct values for all SELLs.
    updateData.pnl = null;
    updateData.netPnl = null;
    updateData.pnlStatus = null;

    const oldAccountId = existing.accountId;
    const newAccountId = data.accountId || existing.accountId;
    const oldSymbol = existing.symbol;
    const newSymbol = data.symbol || existing.symbol;

    return prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.update({ where: { id }, data: updateData });

      // Recompute P&L for the new (accountId, symbol) pair.
      await this.recomputeSymbolPnl(newAccountId, newSymbol, tx);

      // If symbol changed within the same account, recompute the old symbol too.
      if (oldAccountId === newAccountId && oldSymbol !== newSymbol) {
        await this.recomputeSymbolPnl(newAccountId, oldSymbol, tx);
      }

      // If the entry moved to a different account, recompute both old (account, symbol) pairs.
      if (oldAccountId !== newAccountId) {
        await this.recomputeSymbolPnl(oldAccountId, oldSymbol, tx);
        // Also recompute old symbol in new account if it happens to differ (belt-and-suspenders).
        if (oldSymbol !== newSymbol) {
          await this.recomputeSymbolPnl(newAccountId, oldSymbol, tx);
        }
      }

      return tx.ledgerEntry.findFirstOrThrow({ where: { id }, include: { account: true } });
    });
  },

  async delete(id: string, userId: string) {
    const entry = await prisma.ledgerEntry.findFirst({
      where: { id, account: { userId } },
    });
    if (!entry) throw new Error('Entry not found');

    await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.delete({ where: { id } });
      // Recompute remaining SELLs — they now lack this entry's cost-basis contribution.
      await this.recomputeSymbolPnl(entry.accountId, entry.symbol, tx);
    });
  },

  async deleteMany(ids: string[], userId: string) {
    // Verify ownership of all requested entries
    const entries = await prisma.ledgerEntry.findMany({
      where: { id: { in: ids }, account: { userId } },
      select: { id: true, accountId: true, symbol: true },
    });

    const foundIds = new Set(entries.map((e) => e.id));
    const notFound = ids.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) throw new Error('Entry not found');

    // Collect unique (accountId, symbol) pairs to recompute after deletion
    const pairSet = new Map<string, { accountId: string; symbol: string }>();
    for (const e of entries) {
      pairSet.set(`${e.accountId}|${e.symbol}`, { accountId: e.accountId, symbol: e.symbol });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { id: { in: ids } } });
      for (const { accountId, symbol } of pairSet.values()) {
        await this.recomputeSymbolPnl(accountId, symbol, tx);
      }
    });

    return { deleted: entries.length };
  },

  async deleteAll(userId: string) {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map(a => a.id);
    await prisma.ledgerMetadata.deleteMany({
      where: { ledgerEntry: { accountId: { in: accountIds } } },
    });
    return prisma.ledgerEntry.deleteMany({
      where: { accountId: { in: accountIds } },
    });
  },

  // Metadata operations
  async addMetadata(ledgerEntryId: string, key: string, value: string) {
    return prisma.ledgerMetadata.create({
      data: { ledgerEntryId, key, value },
    });
  },

  async getMetadata(ledgerEntryId: string) {
    return prisma.ledgerMetadata.findMany({ where: { ledgerEntryId } });
  },

  async deleteMetadata(id: string) {
    return prisma.ledgerMetadata.delete({ where: { id } });
  },
};
