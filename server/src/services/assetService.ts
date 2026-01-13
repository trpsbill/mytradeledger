import prisma from '../db';
import { CreateAssetRequest, UpdateAssetRequest } from '../types';

export const assetService = {
  async findAll() {
    return prisma.asset.findMany({
      orderBy: { symbol: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
    });
  },

  async findBySymbol(symbol: string) {
    return prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
  },

  async create(data: CreateAssetRequest) {
    return prisma.asset.create({
      data: {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        precision: data.precision ?? 8,
      },
    });
  },

  async update(id: string, data: UpdateAssetRequest) {
    return prisma.asset.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.asset.delete({
      where: { id },
    });
  },
};
