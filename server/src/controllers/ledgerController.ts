import { Request, Response } from 'express';
import { EntryType } from '@prisma/client';
import { ledgerService } from '../services/ledgerService';
import { CreateLedgerEntryRequest, UpdateLedgerEntryRequest, LedgerQueryParams } from '../types';

export const ledgerController = {
  async getAll(req: Request, res: Response) {
    try {
      const params: LedgerQueryParams = {
        symbol: req.query.symbol as string,
        entryType: req.query.entryType as EntryType,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await ledgerService.findAll(params);
      res.json({
        data: result.entries,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
      res.status(500).json({ error: 'Failed to fetch ledger entries' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const entry = await ledgerService.findById(req.params.id);
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
      const data: CreateLedgerEntryRequest = req.body;

      // Validate required fields
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

      // Validate entry type (only BUY or SELL for now)
      const validEntryTypes = ['BUY', 'SELL'];
      if (!validEntryTypes.includes(data.entryType)) {
        return res.status(400).json({
          error: `Invalid entryType. Must be one of: ${validEntryTypes.join(', ')}`,
        });
      }

      // Validate numeric values
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

      const entry = await ledgerService.create(data);
      res.status(201).json({ data: entry });
    } catch (error) {
      console.error('Error creating ledger entry:', error);
      res.status(500).json({ error: 'Failed to create ledger entry' });
    }
  },

  async createBatch(req: Request, res: Response) {
    try {
      const entries: CreateLedgerEntryRequest[] = req.body.entries;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries array is required' });
      }

      const result = await ledgerService.createMany(entries);
      res.status(201).json({ data: { count: result.count } });
    } catch (error) {
      console.error('Error creating ledger entries:', error);
      res.status(500).json({ error: 'Failed to create ledger entries' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data: UpdateLedgerEntryRequest = req.body;

      // Validate entry type if provided
      if (data.entryType) {
        const validEntryTypes = ['BUY', 'SELL'];
        if (!validEntryTypes.includes(data.entryType)) {
          return res.status(400).json({
            error: `Invalid entryType. Must be one of: ${validEntryTypes.join(', ')}`,
          });
        }
      }

      const entry = await ledgerService.update(req.params.id, data);
      res.json({ data: entry });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      console.error('Error updating ledger entry:', error);
      res.status(500).json({ error: 'Failed to update ledger entry' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await ledgerService.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Ledger entry not found' });
      }
      console.error('Error deleting ledger entry:', error);
      res.status(500).json({ error: 'Failed to delete ledger entry' });
    }
  },

  // Metadata endpoints
  async addMetadata(req: Request, res: Response) {
    try {
      const { key, value } = req.body;

      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' });
      }

      const entry = await ledgerService.findById(req.params.id);
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
      const entry = await ledgerService.findById(req.params.id);
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
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Metadata not found' });
      }
      console.error('Error deleting metadata:', error);
      res.status(500).json({ error: 'Failed to delete metadata' });
    }
  },

  async recalculatePnL(req: Request, res: Response) {
    try {
      const result = await ledgerService.recalculateAllPnL();
      res.json({ data: result });
    } catch (error) {
      console.error('Error recalculating P&L:', error);
      res.status(500).json({ error: 'Failed to recalculate P&L' });
    }
  },
};
