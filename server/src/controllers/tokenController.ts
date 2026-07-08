import { Request, Response } from 'express';
import { tokenService } from '../services/tokenService';

export const tokenController = {
  async list(req: Request, res: Response) {
    try {
      const tokens = await tokenService.list(req.user!.userId);
      res.json({ data: tokens });
    } catch (error) {
      console.error('Token list error:', error);
      res.status(500).json({ error: 'Failed to list tokens' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, expiresAt } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Token name is required' });
      }

      let expiryDate: Date | undefined;
      if (expiresAt) {
        expiryDate = new Date(expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return res.status(400).json({ error: 'Invalid expiresAt date' });
        }
        if (expiryDate <= new Date()) {
          return res.status(400).json({ error: 'expiresAt must be in the future' });
        }
      }

      const result = await tokenService.create(req.user!.userId, name.trim(), expiryDate);
      res.status(201).json({ data: result });
    } catch (error) {
      console.error('Token create error:', error);
      res.status(500).json({ error: 'Failed to create token' });
    }
  },

  async revoke(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await tokenService.revoke(id, req.user!.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Token revoke error:', error);
      res.status(500).json({ error: 'Failed to revoke token' });
    }
  },
};
