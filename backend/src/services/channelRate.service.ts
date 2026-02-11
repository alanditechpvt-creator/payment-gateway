import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * New Channel-Based Rate Service
 * 
 * Handles:
 * 1. PAYIN: Channel-based percentage rates (UPI, Cards, etc.)
 * 2. PAYOUT: Slab-based flat charges (IMPS, NEFT)
 * 3. Hierarchical assignment: Schema → User overrides
 * 4. Default fallback rates for unknown channels
 */

export const channelRateService = {
  
  // ===================== CHANNEL MANAGEMENT =====================
  
  /**
   * Get available transaction channels for a payment gateway
   */
  async getChannelsForPG(pgId: string, transactionType?: 'PAYIN' | 'PAYOUT') {
    const where: any = { pgId, isActive: true };
    if (transactionType) {
      where.transactionType = transactionType;
    }
    
    return await prisma.transactionChannel.findMany({
      where,
      include: {
        paymentGateway: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [
        { isDefault: 'asc' }, // Non-default channels first
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
  },
  
  /**
   * Detect channel from PG response payment method string
   * Falls back to default channel if no match found
   */
  async detectChannel(
    pgId: string, 
    rawPaymentMethod: string, 
    transactionType: 'PAYIN' | 'PAYOUT'
  ) {
    if (!rawPaymentMethod) {
      return await this.getDefaultChannel(pgId, transactionType);
    }
    
    // Get all channels for this PG and transaction type
    const channels = await prisma.transactionChannel.findMany({
      where: {
        pgId,
        transactionType,
        isActive: true,
        isDefault: false, // Don't match default channels
      }
    });
    
    // Try to match payment method with channel response codes
    const lowerPaymentMethod = rawPaymentMethod.toLowerCase().trim();
    
    for (const channel of channels) {
      if (!channel.pgResponseCodes) continue;
      
      try {
        const responseCodes: string[] = JSON.parse(channel.pgResponseCodes);
        const matched = responseCodes.some(code => 
          lowerPaymentMethod.includes(code.toLowerCase())
        );
        
        if (matched) {
          return channel;
        }
      } catch (error) {
        console.error(`Failed to parse pgResponseCodes for channel ${channel.id}:`, error);
      }
    }
    
    // No match found - use default channel
    return await this.getDefaultChannel(pgId, transactionType);
  },
  
  /**
   * Get default fallback channel for unknown payment methods
   */
  async getDefaultChannel(pgId: string, transactionType: 'PAYIN' | 'PAYOUT') {
    const defaultChannel = await prisma.transactionChannel.findFirst({
      where: {
        pgId,
        transactionType,
        isDefault: true,
        isActive: true,
      }
    });
    
    if (!defaultChannel) {
      throw new AppError(
        `No default ${transactionType} channel configured for this payment gateway`, 
        500
      );
    }
    
    return defaultChannel;
  },
  
  // ===================== PAYIN RATE MANAGEMENT =====================
  
  /**
   * Get payin rate for a user + channel combination
   * Priority: User rate > Schema rate > Error
   */
  async getPayinRate(userId: string, channelId: string): Promise<number> {
    // Check for user-specific rate first
    const userRate = await prisma.userPayinRate.findUnique({
      where: {
        userId_channelId: { userId, channelId }
      }
    });
    
    if (userRate && userRate.isEnabled) {
      return userRate.payinRate;
    }
    
    // Fall back to schema rate
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true }
    });
    
    if (!user?.schemaId) {
      throw new AppError('User has no schema assigned', 400);
    }
    
    const schemaRate = await prisma.schemaPayinRate.findUnique({
      where: {
        schemaId_channelId: { 
          schemaId: user.schemaId, 
          channelId 
        }
      }
    });
    
    if (!schemaRate || !schemaRate.isEnabled) {
      throw new AppError('No rate configured for this channel', 400);
    }
    
    return schemaRate.payinRate;
  },
  
  /**
   * Get all payin rates for a user (grouped by PG)
   */
  async getUserPayinRates(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true }
    });
    
    if (!user?.schemaId) {
      throw new AppError('User has no schema assigned', 400);
    }
    
    // Get schema rates
    const schemaRates = await prisma.schemaPayinRate.findMany({
      where: {
        schemaId: user.schemaId,
        isEnabled: true
      },
      include: {
        transactionChannel: {
          include: {
            paymentGateway: true
          }
        },
        paymentGateway: true
      }
    });
    
    // Get user-specific overrides
    const userRates = await prisma.userPayinRate.findMany({
      where: {
        userId,
        isEnabled: true
      },
      include: {
        transactionChannel: {
          include: {
            paymentGateway: true
          }
        }
      }
    });
    
    // Merge and group by PG
    const ratesByPG: Record<string, any[]> = {};
    
    schemaRates.forEach(schemaRate => {
      const pgCode = schemaRate.transactionChannel.paymentGateway.code;
      if (!ratesByPG[pgCode]) {
        ratesByPG[pgCode] = [];
      }
      
      // Check if user has override for this channel
      const userOverride = userRates.find(
        ur => ur.channelId === schemaRate.channelId
      );
      
      ratesByPG[pgCode].push({
        channelId: schemaRate.channelId,
        channelCode: schemaRate.transactionChannel.code,
        channelName: schemaRate.transactionChannel.name,
        channelCategory: schemaRate.transactionChannel.category,
        rate: userOverride ? userOverride.payinRate : schemaRate.payinRate,
        isUserOverride: !!userOverride,
        schemaRate: schemaRate.payinRate
      });
    });
    
    return ratesByPG;
  },
  
  /**
   * Assign payin rate to a user (by parent/MD)
   * Must be >= schema rate + parent's markup
   */
  async assignUserPayinRate(
    assignerId: string,
    targetUserId: string,
    channelId: string,
    payinRate: number
  ) {
    // Validate assigner permissions
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: { permissions: true }
    });
    
    if (!assigner) {
      throw new AppError('Assigner not found', 404);
    }
    
    const assignerPermissions = Array.isArray(assigner.permissions) 
      ? assigner.permissions[0] 
      : assigner.permissions;
      
    const canAssign = assigner.role === 'ADMIN' || 
                      assigner.role === 'MASTER_DISTRIBUTOR' ||
                      assignerPermissions?.canAssignRates;
    
    if (!canAssign) {
      throw new AppError('You do not have permission to assign rates', 403);
    }
    
    // Validate target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, parentId: true, schemaId: true }
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    // Check hierarchy
    if (assigner.role !== 'ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only assign rates to your direct children', 403);
    }
    
    // Validate channel exists
    const channel = await prisma.transactionChannel.findUnique({
      where: { id: channelId },
      include: { paymentGateway: true }
    });
    
    if (!channel || !channel.isActive) {
      throw new AppError('Channel not found or inactive', 404);
    }
    
    // Get schema rate for this channel
    if (!targetUser.schemaId) {
      throw new AppError('Target user has no schema assigned', 400);
    }
    
    const schemaRate = await prisma.schemaPayinRate.findUnique({
      where: {
        schemaId_channelId: {
          schemaId: targetUser.schemaId,
          channelId
        }
      }
    });
    
    if (!schemaRate) {
      throw new AppError('No schema rate configured for this channel', 400);
    }
    
    // Validate rate is >= schema rate
    if (payinRate < schemaRate.payinRate) {
      throw new AppError(
        `Rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than schema rate (${(schemaRate.payinRate * 100).toFixed(2)}%)`,
        400
      );
    }
    
    // For non-admin assigners, also check their own rate
    if (assigner.role !== 'ADMIN') {
      const assignerRate = await this.getPayinRate(assignerId, channelId);
      if (payinRate < assignerRate) {
        throw new AppError(
          `Rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than your rate (${(assignerRate * 100).toFixed(2)}%)`,
          400
        );
      }
    }
    
    // Create or update user rate
    const userRate = await prisma.userPayinRate.upsert({
      where: {
        userId_channelId: { userId: targetUserId, channelId }
      },
      update: {
        payinRate,
        assignedById: assignerId,
        isEnabled: true
      },
      create: {
        userId: targetUserId,
        channelId,
        payinRate,
        assignedById: assignerId,
        isEnabled: true
      },
      include: {
        transactionChannel: {
          include: { paymentGateway: true }
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });
    
    // Ensure PG is assigned to user
    await prisma.userPGAssignment.upsert({
      where: {
        userId_pgId: {
          userId: targetUserId,
          pgId: channel.pgId
        }
      },
      update: { isEnabled: true },
      create: {
        userId: targetUserId,
        pgId: channel.pgId,
        isEnabled: true
      }
    });
    
    return userRate;
  },
  
  // ===================== PAYOUT RATE MANAGEMENT =====================
  
  /**
   * Get payout charge for a user + amount
   * Uses slab-based pricing: User slabs > Schema slabs
   */
  async getPayoutCharge(userId: string, amount: number): Promise<number> {
    // Check for user-specific slabs first
    const userPayoutRate = await prisma.userPayoutRate.findUnique({
      where: { userId },
      include: { slabs: { orderBy: { minAmount: 'asc' } } }
    });
    
    if (userPayoutRate && userPayoutRate.slabs.length > 0) {
      return this.calculateSlabCharge(userPayoutRate.slabs, amount);
    }
    
    // Fall back to schema slabs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true }
    });
    
    if (!user?.schemaId) {
      throw new AppError('User has no schema assigned', 400);
    }
    
    const schemaConfig = await prisma.schemaPayoutConfig.findUnique({
      where: { schemaId: user.schemaId },
      include: { slabs: { orderBy: { minAmount: 'asc' } } }
    });
    
    if (!schemaConfig || schemaConfig.slabs.length === 0) {
      throw new AppError('No payout configuration found for user schema', 400);
    }
    
    return this.calculateSlabCharge(schemaConfig.slabs, amount);
  },
  
  /**
   * Calculate charge based on slab configuration
   */
  calculateSlabCharge(slabs: any[], amount: number): number {
    for (const slab of slabs) {
      const inRange = amount >= slab.minAmount && 
                     (slab.maxAmount === null || amount <= slab.maxAmount);
      
      if (inRange) {
        return slab.flatCharge;
      }
    }
    
    // If no slab matches (shouldn't happen with proper config), use last slab
    return slabs[slabs.length - 1]?.flatCharge || 0;
  },
  
  /**
   * Get payout configuration for a user
   */
  async getUserPayoutConfig(userId: string) {
    // Check user-specific config
    const userConfig = await prisma.userPayoutRate.findUnique({
      where: { userId },
      include: {
        slabs: { orderBy: { minAmount: 'asc' } },
        assignedBy: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (userConfig) {
      return {
        type: 'user',
        slabs: userConfig.slabs,
        assignedBy: userConfig.assignedBy
      };
    }
    
    // Fall back to schema config
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true, schema: true }
    });
    
    if (!user?.schemaId) {
      throw new AppError('User has no schema assigned', 400);
    }
    
    const schemaConfig = await prisma.schemaPayoutConfig.findUnique({
      where: { schemaId: user.schemaId },
      include: {
        slabs: { orderBy: { minAmount: 'asc' } },
        paymentGateway: {
          select: { id: true, name: true, code: true }
        }
      }
    });
    
    if (!schemaConfig) {
      throw new AppError('No payout configuration found', 400);
    }
    
    return {
      type: 'schema',
      schema: user.schema,
      slabs: schemaConfig.slabs,
      paymentGateway: schemaConfig.paymentGateway
    };
  },
  
  /**
   * Assign payout slabs to a user (by admin/parent)
   */
  async assignUserPayoutRate(
    assignerId: string,
    targetUserId: string,
    slabs: Array<{ minAmount: number; maxAmount: number | null; flatCharge: number }>
  ) {
    // Validate assigner
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: { permissions: true }
    });
    
    if (!assigner) {
      throw new AppError('Assigner not found', 404);
    }
    
    const assignerPermissions = Array.isArray(assigner.permissions) 
      ? assigner.permissions[0] 
      : assigner.permissions;
      
    const canAssign = assigner.role === 'ADMIN' || 
                      assigner.role === 'MASTER_DISTRIBUTOR' ||
                      assignerPermissions?.canAssignRates;
    
    if (!canAssign) {
      throw new AppError('You do not have permission to assign payout rates', 403);
    }
    
    // Validate target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, parentId: true, schemaId: true }
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    // Check hierarchy
    if (assigner.role !== 'ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only assign rates to your direct children', 403);
    }
    
    // Validate slabs don't overlap and are in order
    const sortedSlabs = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
    for (let i = 0; i < sortedSlabs.length - 1; i++) {
      const current = sortedSlabs[i];
      const next = sortedSlabs[i + 1];
      
      if (current.maxAmount !== null && current.maxAmount >= next.minAmount) {
        throw new AppError('Slabs must not overlap', 400);
      }
    }
    
    // Create or update user payout rate
    const userPayoutRate = await prisma.userPayoutRate.upsert({
      where: { userId: targetUserId },
      update: {
        assignedById: assignerId
      },
      create: {
        userId: targetUserId,
        assignedById: assignerId
      }
    });
    
    // Delete existing slabs
    await prisma.userPayoutSlab.deleteMany({
      where: { userPayoutRateId: userPayoutRate.id }
    });
    
    // Create new slabs
    const createdSlabs = await Promise.all(
      slabs.map(slab =>
        prisma.userPayoutSlab.create({
          data: {
            userPayoutRateId: userPayoutRate.id,
            minAmount: slab.minAmount,
            maxAmount: slab.maxAmount,
            flatCharge: slab.flatCharge
          }
        })
      )
    );
    
    return {
      ...userPayoutRate,
      slabs: createdSlabs
    };
  }
};
