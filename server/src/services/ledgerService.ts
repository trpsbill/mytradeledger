import { Prisma } from '@prisma/client';
import prisma from '../db';
import { CreateLedgerEntryRequest, UpdateLedgerEntryRequest, LedgerQueryParams } from '../types';

const DEFAULT_ACCOUNT_NAME = 'Default';

export const ledgerService = {
  // Export ledger entries to CSV format
  async exportToCsv(params: LedgerQueryParams = {}) {
    const { entries } = await this.findAll({ ...params, limit: 10000 });

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

  // Recalculate P&L for all existing SELL entries
  async recalculateAllPnL() {
    const sellEntries = await prisma.ledgerEntry.findMany({
      where: { entryType: 'SELL' },
      select: { id: true, accountId: true, symbol: true, quantity: true, price: true },
    });

    let updated = 0;
    for (const entry of sellEntries) {
      const avgCost = await this.getAverageCost(entry.accountId, entry.symbol);
      const pnl = avgCost ? entry.price.sub(avgCost).mul(entry.quantity.abs()) : null;

      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { pnl },
      });
      updated++;
    }

    return { updated };
  },

  // Calculate average cost basis for a symbol (for P&L calculation)
  async getAverageCost(accountId: string, symbol: string): Promise<Prisma.Decimal | null> {
    // Get all BUY entries for this symbol
    const buyEntries = await prisma.ledgerEntry.findMany({
      where: {
        accountId,
        symbol,
        entryType: 'BUY',
      },
      select: {
        quantity: true,
        price: true,
      },
    });

    if (buyEntries.length === 0) {
      return null;
    }

    // Calculate total cost and total quantity
    let totalCost = new Prisma.Decimal(0);
    let totalQuantity = new Prisma.Decimal(0);

    for (const entry of buyEntries) {
      const qty = entry.quantity.abs();
      totalCost = totalCost.add(qty.mul(entry.price));
      totalQuantity = totalQuantity.add(qty);
    }

    if (totalQuantity.isZero()) {
      return null;
    }

    return totalCost.div(totalQuantity);
  },

  // Get or create the default account
  async getDefaultAccount() {
    let account = await prisma.account.findFirst({
      where: { name: DEFAULT_ACCOUNT_NAME },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { name: DEFAULT_ACCOUNT_NAME },
      });
    }

    return account;
  },

  async findAll(params: LedgerQueryParams = {}) {
    const { symbol, entryType, startDate, endDate, limit = 100, offset = 0 } = params;

    const where: Prisma.LedgerEntryWhereInput = {};

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
        include: {
          account: true,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return { entries, total, limit, offset };
  },

  async findById(id: string) {
    return prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        account: true,
        metadata: true,
      },
    });
  },

  async create(data: CreateLedgerEntryRequest) {
    // Get default account
    const account = await this.getDefaultAccount();

    // Calculate valueBase: quantity * price (negative for BUY, positive for SELL)
    const quantity = new Prisma.Decimal(data.quantity.toString());
    const price = new Prisma.Decimal(data.price.toString());
    const rawValue = quantity.abs().mul(price);
    const valueBase = data.entryType === 'BUY' ? rawValue.neg() : rawValue;

    // Sign quantity based on entry type
    const signedQuantity = data.entryType === 'SELL' ? quantity.abs().neg() : quantity.abs();

    // Calculate P&L for SELL entries using average cost method
    let pnl: Prisma.Decimal | null = null;
    if (data.entryType === 'SELL') {
      const avgCost = await this.getAverageCost(account.id, data.symbol);
      if (avgCost) {
        // P&L = (sell_price - avg_cost) * quantity
        pnl = price.sub(avgCost).mul(quantity.abs());
      }
    }

    return prisma.ledgerEntry.create({
      data: {
        accountId: account.id,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        entryType: data.entryType,
        symbol: data.symbol,
        quantity: signedQuantity,
        price: price,
        fee: data.fee != null ? new Prisma.Decimal(data.fee.toString()) : null,
        valueBase: valueBase,
        pnl: pnl,
        notes: data.notes,
      },
      include: {
        account: true,
      },
    });
  },

  async createMany(entries: CreateLedgerEntryRequest[]) {
    const account = await this.getDefaultAccount();

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

  async update(id: string, data: UpdateLedgerEntryRequest) {
    const updateData: Prisma.LedgerEntryUpdateInput = {};
    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Entry not found');
    }

    if (data.timestamp) updateData.timestamp = new Date(data.timestamp);
    if (data.entryType) updateData.entryType = data.entryType;
    if (data.symbol) updateData.symbol = data.symbol;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const quantity = data.quantity !== undefined
      ? new Prisma.Decimal(data.quantity.toString())
      : existing.quantity;
    const price = data.price !== undefined
      ? new Prisma.Decimal(data.price.toString())
      : existing.price;
    const entryType = data.entryType || existing.entryType;
    const symbol = data.symbol || existing.symbol;

    // Recalculate valueBase if quantity, price, or entryType changed
    if (data.quantity !== undefined || data.price !== undefined || data.entryType) {
      const rawValue = quantity.abs().mul(price);
      updateData.valueBase = entryType === 'BUY' ? rawValue.neg() : rawValue;
      updateData.quantity = entryType === 'SELL' ? quantity.abs().neg() : quantity.abs();
      updateData.price = price;
    }

    // Recalculate P&L for SELL entries
    if (entryType === 'SELL') {
      const avgCost = await this.getAverageCost(existing.accountId, symbol);
      if (avgCost) {
        updateData.pnl = price.sub(avgCost).mul(quantity.abs());
      } else {
        updateData.pnl = null;
      }
    } else {
      updateData.pnl = null;
    }

    if (data.fee !== undefined) {
      updateData.fee = data.fee != null ? new Prisma.Decimal(data.fee.toString()) : null;
    }

    return prisma.ledgerEntry.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
      },
    });
  },

  async delete(id: string) {
    return prisma.ledgerEntry.delete({
      where: { id },
    });
  },

  async deleteByAccount(accountId: string) {
    return prisma.ledgerEntry.deleteMany({
      where: { accountId },
    });
  },

  // Metadata operations
  async addMetadata(ledgerEntryId: string, key: string, value: string) {
    return prisma.ledgerMetadata.create({
      data: { ledgerEntryId, key, value },
    });
  },

  async getMetadata(ledgerEntryId: string) {
    return prisma.ledgerMetadata.findMany({
      where: { ledgerEntryId },
    });
  },

  async deleteMetadata(id: string) {
    return prisma.ledgerMetadata.delete({
      where: { id },
    });
  },
};
