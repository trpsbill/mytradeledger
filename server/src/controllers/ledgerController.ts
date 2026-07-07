import { Request, Response } from 'express';
import { EntryType, Prisma } from '@prisma/client';
import { ledgerService } from '../services/ledgerService';
import { CreateLedgerEntryRequest, UpdateLedgerEntryRequest, LedgerQueryParams } from '../types';
import prisma from '../db';
import { FREE_LIMIT } from '../services/billingService';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
const MAX_DELETE_BATCH_SIZE = 500;

export const ledgerController = {
  async getAll(req: Request, res: Response) {
    try {
      const params: LedgerQueryParams = {
        userId: req.user!.userId,
        accountId: req.query.accountId as string | undefined,
        symbol: req.query.symbol as string,
        entryType: req.query.entryType as EntryType,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: Math.min(
          req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_PAGE_SIZE,
          MAX_PAGE_SIZE,
        ),
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await ledgerService.findAll(params);
      res.json({
        data: result.entries,
        meta: { total: result.total, limit: result.limit, offset: result.offset },
      });
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
      res.status(500).json({ error: 'Failed to fetch ledger entries' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const entry = await ledgerService.findById(req.params.id, req.user!.userId);
      if (!entry) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      res.json({ data: entry });
    } catch (error) {
      console.error('Error fetching ledger entry:', error);
      res.status(500).json({ error: 'Failed to fetch ledger entry' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const data: CreateLedgerEntryRequest = req.body;

      if (!data.symbol || typeof data.symbol !== 'string' || data.symbol.trim() === '') {
        return res.status(400).json({ error: 'symbol is required' });
      }
      if (!data.entryType) {
        return res.status(400).json({ error: 'entryType is required' });
      }
      if (data.quantity === undefined || data.quantity === null) {
        return res.status(400).json({ error: 'quantity is required' });
      }
      if (data.price === undefined || data.price === null) {
        return res.status(400).json({ error: 'price is required' });
      }

      const validEntryTypes = ['BUY', 'SELL'];
      if (!validEntryTypes.includes(data.entryType)) {
        return res.status(400).json({ error: `Invalid entryType. Must be one of: ${validEntryTypes.join(', ')}` });
      }

      const quantity = parseFloat(data.quantity.toString());
      const price = parseFloat(data.price.toString());
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive number' });
      }
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'price must be a positive number' });
      }
      if (data.fee !== undefined && data.fee !== null) {
        const fee = parseFloat(data.fee.toString());
        if (isNaN(fee) || fee < 0) {
          return res.status(400).json({ error: 'fee must be a non-negative number' });
        }
      }

      const entry = await ledgerService.create(userId, data);

      // Fire-and-forget: mark hasHitFreeLimit once the total crosses the threshold
      prisma.ledgerEntry
        .count({ where: { account: { userId, isDemo: false } } })
        .then(async (total) => {
          if (total >= FREE_LIMIT) {
            await prisma.user.update({
              where: { id: userId },
              data: { hasHitFreeLimit: true },
            });
          }
        })
        .catch(() => {});

      res.status(201).json({ data: entry });
    } catch (error) {
      if (error instanceof Error && error.message === 'accountId is required when multiple accounts exist') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error creating ledger entry:', error);
      res.status(500).json({ error: 'Failed to create ledger entry' });
    }
  },

  async createBatch(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const entries: CreateLedgerEntryRequest[] = req.body.entries;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries array is required' });
      }

      // Cap batch size for free users to remaining slots (mirrors import/commit.ts)
      const freeUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isPaid: true,
          accounts: { where: { isDemo: false }, select: { _count: { select: { ledgerEntries: true } } } },
        },
      });
      let cappedEntries = entries;
      if (!freeUser?.isPaid) {
        const currentCount = (freeUser?.accounts ?? []).reduce((s, a) => s + a._count.ledgerEntries, 0);
        const slotsLeft = Math.max(0, FREE_LIMIT - currentCount);
        cappedEntries = entries.slice(0, slotsLeft);
        if (cappedEntries.length === 0) {
          return res.status(402).json({ error: 'FREE_LIMIT_REACHED', current: currentCount, limit: FREE_LIMIT });
        }
      }

      const result = await ledgerService.createMany(userId, cappedEntries);

      // Set hasHitFreeLimit if the new total crosses the threshold
      if (!freeUser?.isPaid) {
        prisma.ledgerEntry
          .count({ where: { account: { userId, isDemo: false } } })
          .then(async (total) => {
            if (total >= FREE_LIMIT) {
              await prisma.user.update({ where: { id: userId }, data: { hasHitFreeLimit: true } });
            }
          })
          .catch(() => {});
      }

      res.status(201).json({ data: { count: result.count } });
    } catch (error) {
      console.error('Error creating ledger entries:', error);
      res.status(500).json({ error: 'Failed to create ledger entries' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data: UpdateLedgerEntryRequest = req.body;

      if (data.entryType) {
        const validEntryTypes = ['BUY', 'SELL'];
        if (!validEntryTypes.includes(data.entryType)) {
          return res.status(400).json({ error: `Invalid entryType. Must be one of: ${validEntryTypes.join(', ')}` });
        }
      }

      const entry = await ledgerService.update(req.params.id, req.user!.userId, data);
      res.json({ data: entry });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Entry not found') {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      console.error('Error updating ledger entry:', error);
      res.status(500).json({ error: 'Failed to update ledger entry' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await ledgerService.delete(req.params.id, req.user!.userId);
      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Entry not found') {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      console.error('Error deleting ledger entry:', error);
      res.status(500).json({ error: 'Failed to delete ledger entry' });
    }
  },

  async deleteMany(req: Request, res: Response) {
    try {
      const { ids } = req.body as { ids: unknown };
      if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
        return res.status(400).json({ error: 'ids must be a non-empty array of strings' });
      }
      if (ids.length > MAX_DELETE_BATCH_SIZE) {
        return res.status(400).json({ error: `Batch size exceeds maximum of ${MAX_DELETE_BATCH_SIZE}` });
      }
      const result = await ledgerService.deleteMany(ids as string[], req.user!.userId);
      res.json({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Entry not found') {
        return res.status(404).json({ error: 'One or more ledger entries not found' });
      }
      console.error('Error deleting ledger entries:', error);
      res.status(500).json({ error: 'Failed to delete ledger entries' });
    }
  },

  async addMetadata(req: Request, res: Response) {
    try {
      const { key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' });
      }
      const entry = await ledgerService.findById(req.params.id, req.user!.userId);
      if (!entry) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      const metadata = await ledgerService.addMetadata(req.params.id, key, value);
      res.status(201).json({ data: metadata });
    } catch (error) {
      console.error('Error adding metadata:', error);
      res.status(500).json({ error: 'Failed to add metadata' });
    }
  },

  async getMetadata(req: Request, res: Response) {
    try {
      const entry = await ledgerService.findById(req.params.id, req.user!.userId);
      if (!entry) {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      const metadata = await ledgerService.getMetadata(req.params.id);
      res.json({ data: metadata });
    } catch (error) {
      console.error('Error fetching metadata:', error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  },

  async deleteMetadata(req: Request, res: Response) {
    try {
      await ledgerService.deleteMetadata(req.params.metadataId);
      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Metadata not found' });
      }
      console.error('Error deleting metadata:', error);
      res.status(500).json({ error: 'Failed to delete metadata' });
    }
  },

  async recalculatePnL(req: Request, res: Response) {
    try {
      const result = await ledgerService.recalculateAllPnL(req.user!.userId);
      res.json({ data: result });
    } catch (error) {
      console.error('Error recalculating P&L:', error);
      res.status(500).json({ error: 'Failed to recalculate P&L' });
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      const params: LedgerQueryParams = {
        symbol: req.query.symbol as string,
        entryType: req.query.entryType as EntryType,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const csv = await ledgerService.exportToCsv(req.user!.userId, params);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ledger-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  },

  async deleteAll(req: Request, res: Response) {
    try {
      const result = await ledgerService.deleteAll(req.user!.userId);
      res.json({ data: { deleted: result.count } });
    } catch (error) {
      console.error('Error deleting all ledger entries:', error);
      res.status(500).json({ error: 'Failed to delete ledger entries' });
    }
  },
};
