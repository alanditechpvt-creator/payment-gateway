import { Request, Response, NextFunction } from 'express';
import { channelRateService } from '../services/channelRate.service';
import { transactionChannelService } from '../services/transactionChannel.service';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Admin Channel Management Controller
 * Handles transaction channels and rate configuration
 */

export const channelAdminController = {
  
  // ===================== TRANSACTION CHANNEL CRUD =====================
  
  /**
   * GET /api/admin/channels
   * List all transaction channels
   */
  async listChannels(req: Request, res: Response, next: NextFunction) {
    try {
      const { pgId, transactionType, category } = req.query;
      
      const where: any = {};
      if (pgId) where.pgId = pgId as string;
      if (transactionType) where.transactionType = transactionType as string;
      if (category) where.category = category as string;
      
      const channels = await prisma.transactionChannel.findMany({
        where,
        include: {
          paymentGateway: {
            select: { id: true, name: true, code: true }
          },
          _count: {
            select: {
              schemaPayinRates: true,
              userPayinRates: true,
              transactions: true
            }
          }
        },
        orderBy: [
          { paymentGateway: { name: 'asc' } },
          { isDefault: 'asc' },
          { category: 'asc' },
          { name: 'asc' }
        ]
      });
      
      res.json({
        success: true,
        data: {
          channels,
          total: channels.length
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * GET /api/admin/channels/:id
   * Get single channel details
   */
  async getChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const channel = await prisma.transactionChannel.findUnique({
        where: { id },
        include: {
          paymentGateway: true,
          schemaPayinRates: {
            include: {
              schema: {
                select: { id: true, name: true, code: true }
              }
            }
          },
          userPayinRates: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, role: true }
              }
            },
            take: 10
          },
          _count: {
            select: {
              transactions: true
            }
          }
        }
      });
      
      if (!channel) {
        throw new AppError('Channel not found', 404);
      }
      
      res.json({
        success: true,
        data: channel
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * POST /api/admin/channels
   * Create new transaction channel
   */
  async createChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        pgId,
        code,
        name,
        category,
        transactionType,
        cardNetwork,
        cardType,
        baseCost,
        pgResponseCodes,
        isDefault
      } = req.body;
      
      // Validate required fields
      if (!pgId || !code || !name || !category || !transactionType) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate PG exists
      const pg = await prisma.paymentGateway.findUnique({
        where: { id: pgId }
      });
      
      if (!pg) {
        throw new AppError('Payment gateway not found', 404);
      }
      
      // Check for duplicate code within same PG
      const existing = await prisma.transactionChannel.findUnique({
        where: {
          pgId_code: {
            pgId,
            code
          }
        }
      });
      
      if (existing) {
        throw new AppError('Channel with this code already exists for this payment gateway', 400);
      }
      
      // Create channel
      const channel = await prisma.transactionChannel.create({
        data: {
          pgId,
          code,
          name,
          category,
          transactionType,
          cardNetwork,
          cardType,
          baseCost: baseCost || 0.02,
          pgResponseCodes: pgResponseCodes ? JSON.stringify(pgResponseCodes) : null,
          isDefault: isDefault || false,
          isActive: true,
          isCustom: true // Mark as custom (admin-created)
        },
        include: {
          paymentGateway: true
        }
      });
      
      logger.info(`Channel created: ${channel.code} for PG ${pg.code}`);
      
      res.status(201).json({
        success: true,
        message: 'Channel created successfully',
        data: channel
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * PATCH /api/admin/channels/:id/response-codes
   * Update pgResponseCodes for a channel
   */
  async updateChannelResponseCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { responseCodes } = req.body;
      
      if (!Array.isArray(responseCodes)) {
        throw new AppError('responseCodes must be an array of strings', 400);
      }
      
      // Validate all items are strings
      if (!responseCodes.every(code => typeof code === 'string')) {
        throw new AppError('All response codes must be strings', 400);
      }
      
      const channel = await prisma.transactionChannel.findUnique({
        where: { id },
        include: { paymentGateway: true }
      });
      
      if (!channel) {
        throw new AppError('Channel not found', 404);
      }
      
      // Update the pgResponseCodes
      const updatedChannel = await prisma.transactionChannel.update({
        where: { id },
        data: {
          pgResponseCodes: JSON.stringify(responseCodes)
        },
        include: {
          paymentGateway: {
            select: { id: true, name: true, code: true }
          }
        }
      });
      
      logger.info(`Channel response codes updated: ${channel.code} - ${responseCodes.join(', ')}`);
      
      res.json({
        success: true,
        message: 'Response codes updated successfully',
        data: updatedChannel
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * PUT /api/admin/channels/:id
   * Update transaction channel
   */
  async updateChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        cardNetwork,
        cardType,
        baseCost,
        pgResponseCodes,
        isDefault,
        isActive
      } = req.body;
      
      const channel = await prisma.transactionChannel.findUnique({
        where: { id }
      });
      
      if (!channel) {
        throw new AppError('Channel not found', 404);
      }
      
      // Update channel
      const updated = await prisma.transactionChannel.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(category && { category }),
          ...(cardNetwork !== undefined && { cardNetwork }),
          ...(cardType !== undefined && { cardType }),
          ...(baseCost !== undefined && { baseCost }),
          ...(pgResponseCodes && { pgResponseCodes: JSON.stringify(pgResponseCodes) }),
          ...(isDefault !== undefined && { isDefault }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          paymentGateway: true
        }
      });
      
      logger.info(`Channel updated: ${updated.code}`);
      
      res.json({
        success: true,
        message: 'Channel updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * DELETE /api/admin/channels/:id
   * Delete transaction channel (only if no transactions)
   */
  async deleteChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const channel = await prisma.transactionChannel.findUnique({
        where: { id },
        include: {
          _count: {
            select: { transactions: true }
          }
        }
      });
      
      if (!channel) {
        throw new AppError('Channel not found', 404);
      }
      
      // Don't allow deletion of system channels
      if (!channel.isCustom) {
        throw new AppError('Cannot delete system channels', 400);
      }
      
      // Don't allow deletion if transactions exist
      if (channel._count.transactions > 0) {
        throw new AppError('Cannot delete channel with existing transactions. Deactivate instead.', 400);
      }
      
      await prisma.transactionChannel.delete({
        where: { id }
      });
      
      logger.info(`Channel deleted: ${channel.code}`);
      
      res.json({
        success: true,
        message: 'Channel deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== SCHEMA PAYIN RATES =====================
  
  /**
   * GET /api/admin/schemas/:schemaId/payin-rates
   * Get all payin rates for a schema
   */
  async getSchemaPayinRates(req: Request, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      
      const schema = await prisma.schema.findUnique({
        where: { id: schemaId }
      });
      
      if (!schema) {
        throw new AppError('Schema not found', 404);
      }
      
      const rates = await prisma.schemaPayinRate.findMany({
        where: { schemaId },
        include: {
          transactionChannel: {
            include: {
              paymentGateway: {
                select: { id: true, name: true, code: true }
              }
            }
          },
          paymentGateway: {
            select: { id: true, name: true, code: true }
          }
        },
        orderBy: [
          { paymentGateway: { name: 'asc' } },
          { transactionChannel: { category: 'asc' } },
          { transactionChannel: { name: 'asc' } }
        ]
      });
      
      // Group by PG
      const ratesByPG: Record<string, any> = {};
      rates.forEach(rate => {
        const pgCode = rate.paymentGateway.code;
        if (!ratesByPG[pgCode]) {
          ratesByPG[pgCode] = {
            paymentGateway: rate.paymentGateway,
            rates: []
          };
        }
        ratesByPG[pgCode].rates.push({
          id: rate.id,
          channelId: rate.channelId,
          channelCode: rate.transactionChannel.code,
          channelName: rate.transactionChannel.name,
          channelCategory: rate.transactionChannel.category,
          payinRate: rate.payinRate,
          payinRateDisplay: `${(rate.payinRate * 100).toFixed(2)}%`,
          isEnabled: rate.isEnabled
        });
      });
      
      res.json({
        success: true,
        data: {
          schema,
          rates,  // Include flat array for easier frontend access
          ratesByPG
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * POST /api/admin/schemas/:schemaId/payin-rates
   * Set payin rate for a schema + channel
   */
  async setSchemaPayinRate(req: Request, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const { channelId, payinRate, isEnabled } = req.body;
      
      if (!channelId || payinRate === undefined) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate schema
      const schema = await prisma.schema.findUnique({
        where: { id: schemaId }
      });
      
      if (!schema) {
        throw new AppError('Schema not found', 404);
      }
      
      // Validate channel
      const channel = await prisma.transactionChannel.findUnique({
        where: { id: channelId }
      });
      
      if (!channel || channel.transactionType !== 'PAYIN') {
        throw new AppError('Invalid payin channel', 400);
      }
      
      // Validate rate is >= channel base cost
      if (payinRate < channel.baseCost) {
        throw new AppError(
          `Rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than channel base cost (${(channel.baseCost * 100).toFixed(2)}%)`,
          400
        );
      }
      
      // Create or update rate
      const rate = await prisma.schemaPayinRate.upsert({
        where: {
          schemaId_channelId: {
            schemaId,
            channelId
          }
        },
        update: {
          payinRate,
          isEnabled: isEnabled !== undefined ? isEnabled : true
        },
        create: {
          schemaId,
          channelId,
          pgId: channel.pgId,
          payinRate,
          isEnabled: isEnabled !== undefined ? isEnabled : true
        },
        include: {
          transactionChannel: {
            include: {
              paymentGateway: true
            }
          }
        }
      });
      
      logger.info(`Schema payin rate set: ${schema.code} - ${channel.code} = ${(payinRate * 100).toFixed(2)}%`);
      
      res.json({
        success: true,
        message: 'Payin rate set successfully',
        data: rate
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== SCHEMA PAYOUT CONFIG =====================
  
  /**
   * GET /api/admin/schemas/:schemaId/payout-config
   * Get payout configuration for a schema
   */
  async getSchemaPayoutConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { schemaId, pgId } = req.params;
      
      const schema = await prisma.schema.findUnique({
        where: { id: schemaId }
      });
      
      if (!schema) {
        throw new AppError('Schema not found', 404);
      }
      
      // Get the payout config for this schema
      // Note: Currently one schema can only have one payout config (schemaId is unique)
      const config = await prisma.schemaPayoutConfig.findUnique({
        where: { schemaId },
        include: {
          paymentGateway: {
            select: { id: true, name: true, code: true }
          },
          slabs: {
            orderBy: { minAmount: 'asc' }
          }
        }
      });
      
      // Only return config if it matches the requested PG
      if (config && config.pgId !== pgId) {
        res.json({
          success: true,
          data: null  // Different PG requested, return null
        });
        return;
      }
      
      res.json({
        success: true,
        data: config  // Return config directly (not nested)
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * POST /api/admin/schemas/:schemaId/payout-config
   * Set payout configuration for a schema
   */
  async setSchemaPayoutConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { schemaId } = req.params;
      const { pgId, slabs } = req.body;
      
      if (!pgId || !slabs || !Array.isArray(slabs)) {
        throw new AppError('Missing required fields', 400);
      }
      
      // Validate schema
      const schema = await prisma.schema.findUnique({
        where: { id: schemaId }
      });
      
      if (!schema) {
        throw new AppError('Schema not found', 404);
      }
      
      // Validate PG
      const pg = await prisma.paymentGateway.findUnique({
        where: { id: pgId }
      });
      
      if (!pg || !pg.supportedTypes.includes('PAYOUT')) {
        throw new AppError('Invalid payout payment gateway', 400);
      }
      
      // Validate slabs
      const sortedSlabs = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
      for (let i = 0; i < sortedSlabs.length - 1; i++) {
        const current = sortedSlabs[i];
        const next = sortedSlabs[i + 1];
        
        if (current.maxAmount !== null && current.maxAmount >= next.minAmount) {
          throw new AppError('Slabs must not overlap', 400);
        }
      }
      
      // Create or update config
      const config = await prisma.schemaPayoutConfig.upsert({
        where: { schemaId },
        update: { pgId },
        create: {
          schemaId,
          pgId
        }
      });
      
      // Delete old slabs
      await prisma.payoutSlab.deleteMany({
        where: { schemaPayoutConfigId: config.id }
      });
      
      // Create new slabs
      const createdSlabs = await Promise.all(
        slabs.map((slab: any) =>
          prisma.payoutSlab.create({
            data: {
              schemaPayoutConfigId: config.id,
              minAmount: slab.minAmount,
              maxAmount: slab.maxAmount,
              flatCharge: slab.flatCharge
            }
          })
        )
      );
      
      logger.info(`Schema payout config set: ${schema.code} - ${slabs.length} slabs`);
      
      res.json({
        success: true,
        message: 'Payout configuration set successfully',
        data: {
          config,
          slabs: createdSlabs
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  // ===================== STATISTICS =====================
  
  /**
   * GET /api/admin/channels/statistics
   * Get channel usage statistics
   */
  async getChannelStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { pgId, days } = req.query;
      const daysNum = days ? parseInt(days as string) : 30;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      
      const where: any = {
        createdAt: { gte: startDate }
      };
      
      if (pgId) {
        where.pgId = pgId as string;
      }
      
      // Get transaction counts by channel
      const channelStats = await prisma.transaction.groupBy({
        by: ['channelId', 'type', 'status'],
        where,
        _count: true,
        _sum: {
          amount: true,
          pgCharges: true
        }
      });
      
      // Get channel details
      const channelIds = [...new Set(channelStats.map(s => s.channelId).filter(Boolean))];
      const channels = await prisma.transactionChannel.findMany({
        where: { id: { in: channelIds as string[] } },
        include: {
          paymentGateway: {
            select: { name: true, code: true }
          }
        }
      });
      
      // Map stats to channels
      const statsWithChannels = channelStats.map(stat => {
        const channel = channels.find(c => c.id === stat.channelId);
        return {
          ...stat,
          channel: channel ? {
            id: channel.id,
            code: channel.code,
            name: channel.name,
            category: channel.category,
            paymentGateway: channel.paymentGateway
          } : null
        };
      });
      
      res.json({
        success: true,
        data: {
          period: `Last ${daysNum} days`,
          statistics: statsWithChannels
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
