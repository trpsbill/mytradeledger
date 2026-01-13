import { Request, Response } from 'express';
import { accountService } from '../services/accountService';
import { CreateAccountRequest, UpdateAccountRequest } from '../types';

export const accountController = {
  async getAll(req: Request, res: Response) {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const accounts = await accountService.findAll(includeArchived);
      res.json({ data: accounts });
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const account = await accountService.findById(req.params.id);
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

      const account = await accountService.create(data);
      res.status(201).json({ data: account });
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data: UpdateAccountRequest = req.body;
      const account = await accountService.update(req.params.id, data);
      res.json({ data: account });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Account not found' });
      }
      console.error('Error updating account:', error);
      res.status(500).json({ error: 'Failed to update account' });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const account = await accountService.archive(req.params.id);
      res.json({ data: account });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Account not found' });
      }
      console.error('Error archiving account:', error);
      res.status(500).json({ error: 'Failed to archive account' });
    }
  },

  async unarchive(req: Request, res: Response) {
    try {
      const account = await accountService.unarchive(req.params.id);
      res.json({ data: account });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Account not found' });
      }
      console.error('Error unarchiving account:', error);
      res.status(500).json({ error: 'Failed to unarchive account' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await accountService.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Account not found' });
      }
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  },

  async getBalance(req: Request, res: Response) {
    try {
      const account = await accountService.findById(req.params.id);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const balances = await accountService.getBalance(req.params.id);
      res.json({ data: balances });
    } catch (error) {
      console.error('Error fetching account balance:', error);
      res.status(500).json({ error: 'Failed to fetch account balance' });
    }
  },

  async getPnL(req: Request, res: Response) {
    try {
      const account = await accountService.findById(req.params.id);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const pnl = await accountService.getPnL(req.params.id);
      res.json({
        data: {
          accountId: req.params.id,
          baseCurrency: account.baseCurrency,
          totalPnL: pnl,
        }
      });
    } catch (error) {
      console.error('Error fetching account P&L:', error);
      res.status(500).json({ error: 'Failed to fetch account P&L' });
    }
  },
};
