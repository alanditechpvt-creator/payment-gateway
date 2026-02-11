import { Request, Response, NextFunction } from 'express';
import { channelRateService } from '../services/channelRate.service';
import { transactionChannelService } from '../services/transactionChannel.service';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * User Rates Controller
 * MD can assign custom rates to individual users
 */

export const userRatesController = {
  
  // ===================== GET USER RATES =====================
  
  /**
   * GET /api/users/:userId/rates
   * Get all rates for a user (both payin and payout)
   */
  async getUserRates(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      // Validate user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          schema: {
            select: { id: true, name: true, code: true }
          }
        }
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      // Get payin rates
      const payinRates = await channelRateService.getUserPayinRates(userId);
      
      // Get payout config
      const payoutConfig = await channelRateService.getUserPayoutConfig(userId);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            schema: user.schema
          },
          payinRates,
          payoutConfig
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * GET /api/users/:userId/available-channels
   * Get available channels for a user (based on PG assignment)
   */
  async getAvailableChannels(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { transactionType } = req.query;
      
      if (!transactionType || !['PAYIN', 'PAYOUT'].includes(transactionType as string)) {
        throw new AppError('Valid transaction type required (PAYIN or PAYOUT)', 400);
      }
      
      const channels = await transactionChannelService.getAvailableChannelsForUser(
        userId,
        transactionType as 'PAYIN' | 'PAYOUT'
      );
      
      res.json({
        success: true,
        data: channels
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== ASSIGN PAYIN RATES =====================
  
  /**
   * POST /api/users/:userId/payin-rates
   * Assign custom payin rate to a user (MD only)
   */
  async assignPayinRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { channelId, customRate } = req.body;
      const assignerId = req.user!.id; // From auth middleware
      
      if (!channelId || customRate === undefined) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can assign user rates', 403);
      }
      
      // Assign the rate
      const result = await channelRateService.assignUserPayinRate(
        assignerId,
        userId,
        channelId,
        customRate
      );
      
      logger.info(`User payin rate assigned by ${assigner.email}: User ${userId}, Channel ${channelId}, Rate ${(customRate * 100).toFixed(2)}%`);
      
      res.json({
        success: true,
        message: 'Payin rate assigned successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * PUT /api/users/:userId/payin-rates/:rateId
   * Update user's payin rate
   */
  async updatePayinRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, rateId } = req.params;
      const { customRate, isEnabled } = req.body;
      const assignerId = req.user!.id;
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can update user rates', 403);
      }
      
      // Get existing rate
      const existingRate = await prisma.userPayinRate.findUnique({
        where: { id: rateId },
        include: {
          transactionChannel: {
            include: {
              schemaPayinRates: {
                where: {
                  schemaId: (await prisma.user.findUnique({
                    where: { id: userId },
                    select: { schemaId: true }
                  }))!.schemaId!
                }
              }
            }
          }
        }
      });
      
      if (!existingRate || existingRate.userId !== userId) {
        throw new AppError('Rate not found', 404);
      }
      
      // Validate new rate if provided
      if (customRate !== undefined) {
        const schemaRate = existingRate.transactionChannel.schemaPayinRates[0];
        if (!schemaRate) {
          throw new AppError('Schema rate not configured for this channel', 400);
        }
        
        if (customRate < schemaRate.payinRate) {
          throw new AppError(
            `Custom rate (${(customRate * 100).toFixed(2)}%) cannot be lower than schema rate (${(schemaRate.payinRate * 100).toFixed(2)}%)`,
            400
          );
        }
      }
      
      // Update rate
      const updated = await prisma.userPayinRate.update({
        where: { id: rateId },
        data: {
          ...(customRate !== undefined && { customRate }),
          ...(isEnabled !== undefined && { isEnabled }),
          updatedById: assignerId
        },
        include: {
          transactionChannel: {
            include: {
              paymentGateway: true
            }
          },
          assignedBy: {
            select: { email: true }
          },
          updatedBy: {
            select: { email: true }
          }
        }
      });
      
      logger.info(`User payin rate updated by ${assigner.email}: Rate ${rateId}`);
      
      res.json({
        success: true,
        message: 'Payin rate updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * DELETE /api/users/:userId/payin-rates/:rateId
   * Remove user's custom payin rate (fallback to schema rate)
   */
  async removePayinRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, rateId } = req.params;
      const assignerId = req.user!.id;
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can remove user rates', 403);
      }
      
      const existingRate = await prisma.userPayinRate.findUnique({
        where: { id: rateId }
      });
      
      if (!existingRate || existingRate.userId !== userId) {
        throw new AppError('Rate not found', 404);
      }
      
      await prisma.userPayinRate.delete({
        where: { id: rateId }
      });
      
      logger.info(`User payin rate removed by ${assigner.email}: Rate ${rateId}`);
      
      res.json({
        success: true,
        message: 'Payin rate removed successfully. User will now use schema rate.'
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== ASSIGN PAYOUT RATES =====================
  
  /**
   * POST /api/users/:userId/payout-rate
   * Assign custom payout rate slabs to a user (MD only)
   */
  async assignPayoutRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { pgId, slabs } = req.body;
      const assignerId = req.user!.id;
      
      if (!pgId || !slabs || !Array.isArray(slabs)) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can assign user rates', 403);
      }
      
      // Validate user exists and has schema
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          schema: {
            include: {
              payoutConfig: {
                include: {
                  slabs: true
                }
              }
            }
          }
        }
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      if (!user.schemaId || !user.schema?.payoutConfig) {
        throw new AppError('User has no schema payout configuration', 400);
      }
      
      // Validate slabs don't undercut schema rates
      const schemaSlabs = user.schema.payoutConfig.slabs;
      for (const customSlab of slabs) {
        const matchingSchemaSlab = schemaSlabs.find(s =>
          s.minAmount === customSlab.minAmount &&
          (s.maxAmount === null ? customSlab.maxAmount === null : s.maxAmount === customSlab.maxAmount)
        );
        
        if (matchingSchemaSlab && customSlab.flatCharge < matchingSchemaSlab.flatCharge) {
          throw new AppError(
            `Custom slab charge (₹${customSlab.flatCharge}) cannot be lower than schema slab (₹${matchingSchemaSlab.flatCharge}) for range ${customSlab.minAmount}-${customSlab.maxAmount || '∞'}`,
            400
          );
        }
      }
      
      // Create or update user payout rate
      const existingRate = await prisma.userPayoutRate.findUnique({
        where: { userId },
        include: { slabs: true }
      });
      
      let userPayoutRate;
      
      if (existingRate) {
        // Update existing
        await prisma.userPayoutSlab.deleteMany({
          where: { userPayoutRateId: existingRate.id }
        });
        
        userPayoutRate = await prisma.userPayoutRate.update({
          where: { id: existingRate.id },
          data: {
            pgId,
            updatedById: assignerId,
            slabs: {
              create: slabs.map((slab: any) => ({
                minAmount: slab.minAmount,
                maxAmount: slab.maxAmount,
                flatCharge: slab.flatCharge
              }))
            }
          },
          include: {
            slabs: {
              orderBy: { minAmount: 'asc' }
            },
            paymentGateway: true,
            assignedBy: {
              select: { email: true }
            }
          }
        });
      } else {
        // Create new
        userPayoutRate = await prisma.userPayoutRate.create({
          data: {
            userId,
            pgId,
            assignedById: assignerId,
            slabs: {
              create: slabs.map((slab: any) => ({
                minAmount: slab.minAmount,
                maxAmount: slab.maxAmount,
                flatCharge: slab.flatCharge
              }))
            }
          },
          include: {
            slabs: {
              orderBy: { minAmount: 'asc' }
            },
            paymentGateway: true,
            assignedBy: {
              select: { email: true }
            }
          }
        });
      }
      
      logger.info(`User payout rate assigned by ${assigner.email}: User ${userId}, ${slabs.length} slabs`);
      
      res.json({
        success: true,
        message: 'Payout rate assigned successfully',
        data: userPayoutRate
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * DELETE /api/users/:userId/payout-rate
   * Remove user's custom payout rate (fallback to schema rate)
   */
  async removePayoutRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const assignerId = req.user!.id;
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can remove user rates', 403);
      }
      
      const existingRate = await prisma.userPayoutRate.findUnique({
        where: { userId }
      });
      
      if (!existingRate) {
        throw new AppError('User has no custom payout rate', 404);
      }
      
      // Delete slabs first (cascade should handle this, but being explicit)
      await prisma.userPayoutSlab.deleteMany({
        where: { userPayoutRateId: existingRate.id }
      });
      
      await prisma.userPayoutRate.delete({
        where: { id: existingRate.id }
      });
      
      logger.info(`User payout rate removed by ${assigner.email}: User ${userId}`);
      
      res.json({
        success: true,
        message: 'Payout rate removed successfully. User will now use schema rate.'
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== BULK OPERATIONS =====================
  
  /**
   * POST /api/users/bulk-assign-payin-rates
   * Assign same payin rate to multiple users (MD only)
   */
  async bulkAssignPayinRates(req: Request, res: Response, next: NextFunction) {
    try {
      const { userIds, channelId, customRate } = req.body;
      const assignerId = req.user!.id;
      
      if (!userIds || !Array.isArray(userIds) || !channelId || customRate === undefined) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate assigner is MD or Admin
      const assigner = await prisma.user.findUnique({
        where: { id: assignerId }
      });
      
      if (!assigner || !['ADMIN', 'MD'].includes(assigner.role)) {
        throw new AppError('Only MD or Admin can assign user rates', 403);
      }
      
      const results = [];
      const errors = [];
      
      for (const userId of userIds) {
        try {
          const result = await channelRateService.assignUserPayinRate(
            assignerId,
            userId,
            channelId,
            customRate
          );
          results.push({ userId, success: true, data: result });
        } catch (error: any) {
          errors.push({ userId, success: false, error: error.message });
        }
      }
      
      logger.info(`Bulk payin rate assignment by ${assigner.email}: ${results.length} success, ${errors.length} errors`);
      
      res.json({
        success: true,
        message: `Assigned rates to ${results.length} users`,
        data: {
          successful: results,
          failed: errors
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
