import { Request, Response } from 'express';
import { accountService } from '../services/accountService';
import { demoService } from '../services/demoService';
import { CreateAccountRequest, UpdateAccountRequest } from '../types';

export const accountController = {
  async getAll(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const includeArchived = req.query.includeArchived === 'true';
      const accounts = await accountService.findAll(userId, includeArchived);
      res.json({ data: accounts });
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const account = await accountService.findById(req.params.id, req.user!.userId);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({ data: account });
    } catch (error) {
      console.error('Error fetching account:', error);
      res.status(500).json({ error: 'Failed to fetch account' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data: CreateAccountRequest = req.body;
      if (!data.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const account = await accountService.create(req.user!.userId, data);
      res.status(201).json({ data: account });
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data: UpdateAccountRequest = req.body;
      const result = await accountService.update(req.params.id, req.user!.userId, data);
      if (result.count === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      const account = await accountService.findById(req.params.id, req.user!.userId);
      res.json({ data: account });
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).json({ error: 'Failed to update account' });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const result = await accountService.archive(req.params.id, req.user!.userId);
      if (result.count === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      const account = await accountService.findById(req.params.id, req.user!.userId);
      res.json({ data: account });
    } catch (error) {
      console.error('Error archiving account:', error);
      res.status(500).json({ error: 'Failed to archive account' });
    }
  },

  async unarchive(req: Request, res: Response) {
    try {
      const result = await accountService.unarchive(req.params.id, req.user!.userId);
      if (result.count === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      const account = await accountService.findById(req.params.id, req.user!.userId);
      res.json({ data: account });
    } catch (error) {
      console.error('Error unarchiving account:', error);
      res.status(500).json({ error: 'Failed to unarchive account' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await accountService.delete(req.params.id, req.user!.userId);
      if (result.count === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  },

  async getBalance(req: Request, res: Response) {
    try {
      const balances = await accountService.getBalance(req.params.id, req.user!.userId);
      if (balances === null) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({ data: balances });
    } catch (error) {
      console.error('Error fetching account balance:', error);
      res.status(500).json({ error: 'Failed to fetch account balance' });
    }
  },

  async seedDemo(req: Request, res: Response) {
    try {
      const account = await demoService.seedDemoAccount(req.user!.userId);
      res.status(201).json({ data: account });
    } catch (error) {
      console.error('Error seeding demo account:', error);
      res.status(500).json({ error: 'Failed to create demo account' });
    }
  },

  async setDefault(req: Request, res: Response) {
    try {
      const account = await accountService.setDefault(req.params.id, req.user!.userId);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({ data: account });
    } catch (error) {
      console.error('Error setting default account:', error);
      res.status(500).json({ error: 'Failed to set default account' });
    }
  },

  async getPnL(req: Request, res: Response) {
    try {
      const result = await accountService.getPnL(req.params.id, req.user!.userId);
      if (result === null) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({
        data: {
          accountId: req.params.id,
          baseCurrency: result.account.baseCurrency,
          totalPnL: result.totalPnL,
          totalNetPnL: result.totalNetPnL,
          totalFees: result.totalFees,
          uncomputableCount: result.uncomputableCount,
        },
      });
    } catch (error) {
      console.error('Error fetching account P&L:', error);
      res.status(500).json({ error: 'Failed to fetch account P&L' });
    }
  },
};
