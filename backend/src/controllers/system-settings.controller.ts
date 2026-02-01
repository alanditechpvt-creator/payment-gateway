
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

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

      const config = {
        activePgId: settings.find(s => s.key === 'GLOBAL_PAYOUT_PG_ID')?.value || '',
        slabs: JSON.parse(settings.find(s => s.key === 'GLOBAL_PAYOUT_SLABS')?.value || '[]')
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
