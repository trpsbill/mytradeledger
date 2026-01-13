import { Request, Response } from 'express';
import { assetService } from '../services/assetService';
import { CreateAssetRequest, UpdateAssetRequest } from '../types';

export const assetController = {
  async getAll(_req: Request, res: Response) {
    try {
      const assets = await assetService.findAll();
      res.json({ data: assets });
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const asset = await assetService.findById(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      res.json({ data: asset });
    } catch (error) {
      console.error('Error fetching asset:', error);
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data: CreateAssetRequest = req.body;

      if (!data.symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      // Check if symbol already exists
      const existing = await assetService.findBySymbol(data.symbol);
      if (existing) {
        return res.status(409).json({ error: 'Asset with this symbol already exists' });
      }

      const asset = await assetService.create(data);
      res.status(201).json({ data: asset });
    } catch (error) {
      console.error('Error creating asset:', error);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data: UpdateAssetRequest = req.body;
      const asset = await assetService.update(req.params.id, data);
      res.json({ data: asset });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset not found' });
      }
      console.error('Error updating asset:', error);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await assetService.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset not found' });
      }
      console.error('Error deleting asset:', error);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  },
};
