import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Default payout slabs when none configured (0-50k = ₹10 as per applicable PG)
const DEFAULT_PAYOUT_SLABS = [
  { minAmount: 0, maxAmount: 50000, flatCharge: 10 },
  { minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
  { minAmount: 200001, maxAmount: null, flatCharge: 25 },
];

export const systemSettingsController = {
  /**
   * Get global payout configuration
   */
  async getGlobalPayoutConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.systemSettings.findMany({
        where: {
          key: {
            in: ['GLOBAL_PAYOUT_PG_ID', 'GLOBAL_PAYOUT_SLABS']
          }
        }
      });

      const slabsRaw = JSON.parse(settings.find(s => s.key === 'GLOBAL_PAYOUT_SLABS')?.value || '[]');
      const slabs = Array.isArray(slabsRaw) && slabsRaw.length > 0 ? slabsRaw : DEFAULT_PAYOUT_SLABS;

      const config = {
        activePgId: settings.find(s => s.key === 'GLOBAL_PAYOUT_PG_ID')?.value || '',
        slabs
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update global payout configuration
   */
  async updateGlobalPayoutConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { activePgId, slabs } = req.body;

      if (!activePgId) {
        throw new AppError('Active PG ID is required', 400);
      }

      // Validate slabs
      if (!Array.isArray(slabs)) {
        throw new AppError('Slabs must be an array', 400);
      }

      await prisma.$transaction([
        prisma.systemSettings.upsert({
          where: { key: 'GLOBAL_PAYOUT_PG_ID' },
          update: { value: activePgId },
          create: {
            key: 'GLOBAL_PAYOUT_PG_ID',
            value: activePgId,
            category: 'PAYOUT',
            description: 'Global active Payment Gateway for Payouts'
          }
        }),
        prisma.systemSettings.upsert({
          where: { key: 'GLOBAL_PAYOUT_SLABS' },
          update: { value: JSON.stringify(slabs) },
          create: {
            key: 'GLOBAL_PAYOUT_SLABS',
            value: JSON.stringify(slabs),
            category: 'PAYOUT',
            description: 'Global slab configuration for Payouts'
          }
        })
      ]);

      res.json({
        success: true,
        message: 'Global payout configuration updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};
