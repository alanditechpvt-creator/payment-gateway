import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

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
   * Detect channel from PG response payment method string.
   * If no card type matches, the "Other Payment Methods" (default) channel is used and its rate is applied.
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
    const networkTokens = ['rupay', 'visa', 'master', 'mastercard', 'amex', 'diners', 'discover', 'jcb'];

    const matches: { channel: typeof channels[0]; isNetworkSpecific: boolean }[] = [];
    for (const channel of channels) {
      if (!channel.pgResponseCodes) continue;
      try {
        const responseCodes: string[] = JSON.parse(channel.pgResponseCodes);
        const matched = responseCodes.some(code =>
          lowerPaymentMethod.includes(code.toLowerCase())
        );
        if (matched) {
          const isNetworkSpecific = networkTokens.some(
            token => lowerPaymentMethod.includes(token) && responseCodes.some(c => c.toLowerCase().includes(token))
          );
          matches.push({ channel, isNetworkSpecific });
        }
      } catch (error) {
        console.error(`Failed to parse pgResponseCodes for channel ${channel.id}:`, error);
      }
    }

    // Prefer network-specific channel (e.g. RuPay) over generic (e.g. "debit") so RuPay debit gets RuPay rate
    const networkMatch = matches.find(m => m.isNetworkSpecific);
    if (networkMatch) return networkMatch.channel;
    if (matches.length > 0) return matches[0].channel;

    // No card type matched - apply "Other Payment Methods" (default channel) rate
    return await this.getDefaultChannel(pgId, transactionType);
  },
  
  /**
   * Get default fallback channel when no card type matches the PG response.
   * Uses the channel marked "Other Payment Methods" (isDefault: true); if none, uses first active channel.
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

    if (defaultChannel) {
      return defaultChannel;
    }

    // No "Other Payment Methods" channel - use first active channel so a rate is always applied
    const fallback = await prisma.transactionChannel.findFirst({
      where: {
        pgId,
        transactionType,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    if (!fallback) {
      throw new AppError(
        `No ${transactionType} channel configured for this payment gateway`,
        500
      );
    }

    return fallback;
  },
  
  // ===================== PAYIN RATE MANAGEMENT =====================
  
  /**
   * Get payin rate for a user + channel (used for deduction).
   * Priority: User override > Schema rate for this channel > channel base (baseCost).
   */
  async getPayinRate(userId: string, channelId: string): Promise<number> {
    const userRate = await prisma.userPayinRate.findUnique({
      where: { userId_channelId: { userId, channelId } },
    });
    if (userRate?.isEnabled) return Number(userRate.payinRate);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true },
    });
    if (!user?.schemaId) throw new AppError('User has no schema assigned', 400);

    const schemaRate = await prisma.schemaPayinRate.findUnique({
      where: {
        schemaId_channelId: { schemaId: user.schemaId, channelId },
      },
    });
    if (schemaRate?.isEnabled) return Number(schemaRate.payinRate);

    const channel = await prisma.transactionChannel.findUnique({
      where: { id: channelId },
      select: { baseCost: true },
    });
    return channel ? Number(channel.baseCost ?? 0.02) : 0.02;
  },

  /**
   * Get the rate to show and deduct for this user on this channel.
   * User override (if any) else schema rate for this exact channel else schema default.
   */
  async getPayinRateForUser(userId: string, channelId: string): Promise<number> {
    const userRate = await prisma.userPayinRate.findUnique({
      where: { userId_channelId: { userId, channelId } },
    });
    if (userRate?.isEnabled) return Number(userRate.payinRate);

    return this.getSchemaPayinRateOnly(userId, channelId);
  },

  /**
   * Get schema payin rate only (no user override). Used for actual deduction so charge matches displayed schema rate.
   */
  async getSchemaPayinRateOnly(userId: string, channelId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true },
    });
    if (!user?.schemaId) throw new AppError('User has no schema assigned', 400);

    const [schemaRow, schema] = await Promise.all([
      prisma.schemaPayinRate.findUnique({
        where: { schemaId_channelId: { schemaId: user.schemaId, channelId } },
      }),
      prisma.schema.findUnique({
        where: { id: user.schemaId },
        select: { payinRate: true },
      }),
    ]);
    const schemaDefaultRate = schema ? Number(schema.payinRate ?? 0.02) : 0.02;
    if (schemaRow?.isEnabled) return Math.max(Number(schemaRow.payinRate), schemaDefaultRate);
    return schemaDefaultRate;
  },
  
  /**
   * Get all payin rates for a user (grouped by PG). Per-channel schema rates; base = channel.baseCost.
   */
  async getUserPayinRates(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { schemaId: true },
    });
    if (!user?.schemaId) throw new AppError('User has no schema assigned', 400);

    const [assignments, schemaRates, userRates, schema] = await Promise.all([
      prisma.userPGAssignment.findMany({
        where: { userId, isEnabled: true },
        include: {
          paymentGateway: {
            include: {
              transactionChannels: {
                where: { isActive: true, transactionType: 'PAYIN' },
              },
            },
          },
        },
      }),
      prisma.schemaPayinRate.findMany({
        where: { schemaId: user.schemaId, isEnabled: true },
        include: { transactionChannel: { include: { paymentGateway: true } } },
      }),
      prisma.userPayinRate.findMany({
        where: { userId, isEnabled: true },
        include: { transactionChannel: { include: { paymentGateway: true } } },
      }),
      prisma.schema.findUnique({
        where: { id: user.schemaId },
        select: { payinRate: true, code: true, name: true },
      }),
    ]);

    const schemaDefaultRate = schema ? Number(schema.payinRate ?? 0.02) : 0.02;
    logger.info(`[getUserPayinRates] userId=${userId} schemaId=${user.schemaId} schemaCode=${(schema as any)?.code} schemaDefault=${(schemaDefaultRate * 100).toFixed(1)}% schemaRatesCount=${schemaRates.length}`);
    const ratesByPG: Record<string, any[]> = {};
    for (const a of assignments) {
      const pg = a.paymentGateway;
      const pgCode = pg.code;
      if (!ratesByPG[pgCode]) ratesByPG[pgCode] = [];
      for (const ch of pg.transactionChannels) {
        const userOverride = userRates.find(ur => ur.channelId === ch.id);
        // Exact channel only: schema row for this channelId. No "same type" / max across PGs.
        const schemaRow = schemaRates.find(sr => sr.channelId === ch.id);
        const schemaRate = schemaRow
          ? Math.max(Number(schemaRow.payinRate), schemaDefaultRate)
          : schemaDefaultRate;
        const effectiveRate = userOverride ? Number(userOverride.payinRate) : schemaRate;

        ratesByPG[pgCode].push({
          channelId: ch.id,
          channelCode: ch.code,
          channelName: ch.name,
          channelCategory: ch.category,
          cardNetwork: (ch as any).cardNetwork ?? null,
          cardType: (ch as any).cardType ?? null,
          rate: effectiveRate,
          isUserOverride: !!userOverride,
          schemaRate,
        });
      }
    }
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
    
    // Validate target user (include schema for rate validation)
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { schema: true }
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
    
    if (!targetUser.schemaId) {
      throw new AppError('Target user has no schema assigned', 400);
    }
    const schemaRow = await prisma.schemaPayinRate.findUnique({
      where: {
        schemaId_channelId: { schemaId: targetUser.schemaId, channelId },
      },
    });
    const minRate = schemaRow ? Number(schemaRow.payinRate) : Number(channel.baseCost ?? 0.02);
    if (payinRate < minRate) {
      throw new AppError(
        `Rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than schema/channel rate (${(minRate * 100).toFixed(2)}%)`,
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
