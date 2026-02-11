import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { channelRateService } from './channelRate.service';
import { logger } from '../utils/logger';

/**
 * Transaction Channel Helper Service
 * Handles channel detection and charge calculation for new rate system
 */

export const transactionChannelService = {
  
  /**
   * Detect channel and calculate charges for a transaction
   * Returns channel info, rates, and calculated charges
   */
  async calculateTransactionCharges(
    userId: string,
    pgId: string,
    amount: number,
    type: 'PAYIN' | 'PAYOUT',
    rawPaymentMethod?: string
  ): Promise<{
    channelId: string;
    channelCode: string;
    channelName: string;
    rate: number | null; // null for payout (slab-based)
    pgCharges: number;
    platformCommission: number;
    netAmount: number;
    chargeDetails: any;
  }> {
    
    if (type === 'PAYIN') {
      return await this.calculatePayinCharges(userId, pgId, amount, rawPaymentMethod);
    } else {
      return await this.calculatePayoutCharges(userId, pgId, amount, rawPaymentMethod);
    }
  },
  
  /**
   * Calculate charges for PAYIN transaction
   * Uses channel-based percentage rates
   */
  async calculatePayinCharges(
    userId: string,
    pgId: string,
    amount: number,
    rawPaymentMethod?: string
  ) {
    // Detect channel from payment method
    let channel;
    if (rawPaymentMethod) {
      channel = await channelRateService.detectChannel(pgId, rawPaymentMethod, 'PAYIN');
      logger.info(`Channel detected: ${channel.code} (${channel.name}) for payment method: ${rawPaymentMethod}`);
    } else {
      // No payment method yet (creating order) - will detect later on callback
      // For now, return placeholder values
      return {
        channelId: '',
        channelCode: 'unknown',
        channelName: 'To be determined',
        rate: 0,
        pgCharges: 0,
        platformCommission: 0,
        netAmount: amount,
        chargeDetails: {
          type: 'PENDING_DETECTION',
          message: 'Channel will be detected after payment'
        }
      };
    }
    
    // Get user's rate for this channel
    const rate = await channelRateService.getPayinRate(userId, channel.id);
    
    // Calculate charges
    const pgCharges = amount * rate;
    
    // Platform commission is the difference between what user pays and PG's base cost
    const platformCommission = amount * (rate - channel.baseCost);
    
    // Net amount user receives (for payin, it's the original amount minus charges)
    const netAmount = amount - pgCharges;
    
    return {
      channelId: channel.id,
      channelCode: channel.code,
      channelName: channel.name,
      rate,
      pgCharges,
      platformCommission,
      netAmount,
      chargeDetails: {
        type: 'PERCENTAGE',
        rate,
        rateDisplay: `${(rate * 100).toFixed(2)}%`,
        baseCost: channel.baseCost,
        baseCostDisplay: `${(channel.baseCost * 100).toFixed(2)}%`,
        channelCategory: channel.category,
        isDefault: channel.isDefault
      }
    };
  },
  
  /**
   * Calculate charges for PAYOUT transaction
   * Uses slab-based flat charges
   */
  async calculatePayoutCharges(
    userId: string,
    pgId: string,
    amount: number,
    rawPaymentMethod?: string
  ) {
    // Detect channel (IMPS, NEFT, or default)
    let channel;
    if (rawPaymentMethod) {
      channel = await channelRateService.detectChannel(pgId, rawPaymentMethod, 'PAYOUT');
      logger.info(`Payout channel detected: ${channel.code} (${channel.name}) for method: ${rawPaymentMethod}`);
    } else {
      // Default to IMPS for now
      const channels = await channelRateService.getChannelsForPG(pgId, 'PAYOUT');
      channel = channels.find(c => c.code === 'imps') || channels[0];
    }
    
    // Get payout charge based on slabs
    const pgCharges = await channelRateService.getPayoutCharge(userId, amount);
    
    // For payout, platform commission is 0 (flat charge model)
    const platformCommission = 0;
    
    // Net amount is amount minus flat charge
    const netAmount = amount - pgCharges;
    
    // Get slab details for display
    const userConfig = await channelRateService.getUserPayoutConfig(userId);
    const applicableSlab = userConfig.slabs.find(
      (slab: any) => amount >= slab.minAmount && (slab.maxAmount === null || amount <= slab.maxAmount)
    );
    
    return {
      channelId: channel.id,
      channelCode: channel.code,
      channelName: channel.name,
      rate: null, // Payout doesn't use percentage rate
      pgCharges,
      platformCommission,
      netAmount,
      chargeDetails: {
        type: 'SLAB',
        flatCharge: pgCharges,
        flatChargeDisplay: `₹${pgCharges}`,
        slabMin: applicableSlab?.minAmount,
        slabMax: applicableSlab?.maxAmount,
        slabDisplay: applicableSlab 
          ? `₹${applicableSlab.minAmount.toLocaleString('en-IN')} - ${applicableSlab.maxAmount ? `₹${applicableSlab.maxAmount.toLocaleString('en-IN')}` : '₹∞'}`
          : 'Unknown',
        configType: userConfig.type,
        channelCategory: channel.category,
        isDefault: channel.isDefault
      }
    };
  },
  
  /**
   * Update transaction with detected channel after payment callback
   * Used when channel wasn't known at transaction creation
   */
  async updateTransactionChannel(
    transactionId: string,
    rawPaymentMethod: string
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });
    
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    // Detect channel
    const channel = await channelRateService.detectChannel(
      transaction.pgId,
      rawPaymentMethod,
      transaction.type as 'PAYIN' | 'PAYOUT'
    );
    
    logger.info(`Updating transaction ${transactionId} with channel: ${channel.code}`);
    
    // Recalculate charges with detected channel
    const charges = await this.calculateTransactionCharges(
      transaction.initiatorId,
      transaction.pgId,
      transaction.amount,
      transaction.type as 'PAYIN' | 'PAYOUT',
      rawPaymentMethod
    );
    
    // Update transaction
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        channelId: channel.id,
        rawPaymentMethod,
        pgCharges: charges.pgCharges,
        platformCommission: charges.platformCommission,
        netAmount: charges.netAmount
      },
      include: {
        transactionChannel: true,
        paymentGateway: true,
        initiator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });
    
    logger.info(`Transaction ${transactionId} updated: channel=${channel.code}, charges=${charges.pgCharges}`);
    
    return updated;
  },
  
  /**
   * Get all available payment channels for a user
   * Based on their schema and PG assignments
   */
  async getAvailableChannelsForUser(
    userId: string,
    transactionType: 'PAYIN' | 'PAYOUT'
  ) {
    // Get user's assigned PGs
    const userPGAssignments = await prisma.userPGAssignment.findMany({
      where: {
        userId,
        isEnabled: true
      },
      include: {
        paymentGateway: true
      }
    });
    
    if (userPGAssignments.length === 0) {
      return [];
    }
    
    // Get user's schema
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true }
    });
    
    if (!user?.schemaId) {
      throw new AppError('User has no schema assigned', 400);
    }
    
    // Get channels for each PG
    const channelsByPG = [];
    
    for (const assignment of userPGAssignments) {
      if (!assignment.paymentGateway.supportedTypes.includes(transactionType)) {
        continue;
      }
      
      const channels = await channelRateService.getChannelsForPG(
        assignment.pgId,
        transactionType
      );
      
      // Get rates for each channel
      const channelsWithRates = await Promise.all(
        channels.map(async (channel) => {
          try {
            let rateInfo;
            
            if (transactionType === 'PAYIN') {
              const rate = await channelRateService.getPayinRate(userId, channel.id);
              rateInfo = {
                rate,
                rateDisplay: `${(rate * 100).toFixed(2)}%`,
                type: 'PERCENTAGE'
              };
            } else {
              // For payout, show slab info instead of single rate
              const config = await channelRateService.getUserPayoutConfig(userId);
              rateInfo = {
                slabs: config.slabs,
                type: 'SLAB',
                configType: config.type
              };
            }
            
            return {
              ...channel,
              rateInfo
            };
          } catch (error) {
            // Channel not configured for user, skip it
            return null;
          }
        })
      );
      
      channelsByPG.push({
        paymentGateway: assignment.paymentGateway,
        channels: channelsWithRates.filter(c => c !== null)
      });
    }
    
    return channelsByPG;
  },
  
  /**
   * Validate channel is available for user
   */
  async validateChannelForUser(
    userId: string,
    channelId: string
  ): Promise<boolean> {
    const channel = await prisma.transactionChannel.findUnique({
      where: { id: channelId }
    });
    
    if (!channel || !channel.isActive) {
      return false;
    }
    
    // Check user has PG assigned
    const pgAssignment = await prisma.userPGAssignment.findUnique({
      where: {
        userId_pgId: {
          userId,
          pgId: channel.pgId
        }
      }
    });
    
    if (!pgAssignment || !pgAssignment.isEnabled) {
      return false;
    }
    
    // Check user has rate configured for this channel
    try {
      if (channel.transactionType === 'PAYIN') {
        await channelRateService.getPayinRate(userId, channelId);
      } else {
        await channelRateService.getPayoutCharge(userId, 1000); // Test with any amount
      }
      return true;
    } catch (error) {
      return false;
    }
  }
};
