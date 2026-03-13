import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { userService } from './user.service';

/**
 * Hierarchical Rate Assignment System
 * 
 * Flow:
 * 1. PG has a base rate (0.8%) - what PG charges the platform
 * 2. Admin assigns rates to White Labels (WL): Admin sees base rate, assigns higher rate to WL
 *    - Admin assigns 1% to WL1 → Admin earns 1% - 0.8% = 0.2%
 *    - Admin assigns 1.2% to WL2 → Admin earns 1.2% - 0.8% = 0.4%
 * 3. WL assigns rates to MD: WL sees their rate (1%), assigns higher to MD
 *    - WL1 assigns 1.5% to MD1 → WL1 earns 1.5% - 1% = 0.5%
 * 4. MD assigns rates to Distributor/Retailer
 *    - MD1 assigns 1.8% to Dist1 → MD1 earns 1.8% - 1.5% = 0.3%
 * 
 * When Dist1 does ₹10,000 transaction:
 * - Transaction charged at: 1.8% = ₹180
 * - PG takes: 0.8% = ₹80
 * - Admin gets: 0.2% = ₹20
 * - WL1 gets: 0.5% = ₹50
 * - MD1 gets: 0.3% = ₹30
 */

export const rateService = {
  /**
   * Get the rate assigned to a user for a specific PG
   * Returns the rate they are CHARGED (their cost)
   */
  async getUserRate(userId: string, pgId: string, type: 'PAYIN' | 'PAYOUT' = 'PAYIN', channelId?: string): Promise<number> {
    const pgAssignment = await prisma.userPGAssignment.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    if (!pgAssignment || !pgAssignment.isEnabled) {
      throw new AppError('Payment gateway not assigned to user', 404);
    }

    if (channelId && type === 'PAYIN') {
      const userRate = await prisma.userPayinRate.findUnique({
        where: { userId_channelId: { userId, channelId } },
      });
      if (userRate?.isEnabled) return Number(userRate.payinRate);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { schemaId: true },
      });
      if (user?.schemaId) {
        const schemaRate = await prisma.schemaPayinRate.findUnique({
          where: {
            schemaId_channelId: { schemaId: user.schemaId, channelId },
          },
        });
        if (schemaRate?.isEnabled) return Number(schemaRate.payinRate);
      }
      const ch = await prisma.transactionChannel.findUnique({
        where: { id: channelId },
        select: { baseCost: true },
      });
      return ch ? Number(ch.baseCost ?? 0.02) : 0.02;
    }

    if (type === 'PAYIN') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { schema: true },
      });
      if (user?.schema?.isActive && user.schema.payinRate != null) {
        return Number(user.schema.payinRate);
      }
      const channels = await prisma.transactionChannel.findMany({
        where: { pgId, transactionType: 'PAYIN', isActive: true },
        select: { baseCost: true },
      });
      if (channels.length > 0) {
        return Math.min(...channels.map(c => Number(c.baseCost)));
      }
    }
    return 0.02;
  },
  
  /**
   * Get all rates assigned to a user (for all PGs).
   * Payin rate = user's schema rate (one per schema) when they have a schema; else PG base.
   */
  async getUserRates(userId: string) {
    const [pgAssignments, user] = await Promise.all([
      prisma.userPGAssignment.findMany({
        where: { userId, isEnabled: true },
        include: {
        paymentGateway: {
          select: { id: true, name: true, code: true, isActive: true, supportedTypes: true },
        },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: { schema: true },
      }),
    ]);
    
    const schemaPayin = user?.schema?.isActive && user.schema.payinRate != null
      ? Number(user.schema.payinRate)
      : null;
    
    const defaultRate = 0.02;
    const rates = pgAssignments.map(assignment => ({
      id: assignment.id,
      userId: assignment.userId,
      pgId: assignment.pgId,
      payinRate: schemaPayin ?? defaultRate,
      payoutRate: defaultRate,
      isEnabled: assignment.isEnabled,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      paymentGateway: assignment.paymentGateway,
    }));
    
    return rates;
  },
  
  /**
   * Get PG assignments (rates) for a specific user. Used by admin to view any user's assigned PGs,
   * or by parent to view a direct child's assignments.
   * Authorize: ADMIN can view any user; others only their direct child.
   */
  async getRatesForUser(requesterId: string, targetUserId: string) {
    const [requester, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: requesterId } }),
      prisma.user.findUnique({ where: { id: targetUserId } }),
    ]);
    if (!requester || !target) {
      throw new AppError('User not found', 404);
    }
    const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPER_ADMIN';
    const isDirectChild = target.parentId === requesterId;
    if (!isAdmin && !isDirectChild) {
      throw new AppError('You can only view rates for your direct children or as admin', 403);
    }
    return this.getUserRates(targetUserId);
  },

  /**
   * Get the minimum rate visible to a user for a PG.
   * Base rate is per channel (channel.baseCost); here we return the minimum channel base for reference.
   */
  async getBaseRateForUser(userId: string, pgId: string): Promise<{ payinRate: number; payoutRate: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const defaultRate = 0.02;
    const channels = await prisma.transactionChannel.findMany({
      where: { pgId, transactionType: 'PAYIN', isActive: true },
      select: { baseCost: true },
    });
    const minBase = channels.length > 0
      ? Math.min(...channels.map(c => Number(c.baseCost)))
      : defaultRate;
    
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return { payinRate: minBase, payoutRate: minBase };
    }
    
    const pgAssignment = await prisma.userPGAssignment.findUnique({
      where: { userId_pgId: { userId, pgId } },
    });
    
    if (pgAssignment?.isEnabled) {
      return { payinRate: minBase, payoutRate: minBase };
    }
    
    return { payinRate: 0, payoutRate: 0 };
  },
  
  /**
   * Assign rate to a child user
   * - Parent can only assign rates >= their own rate
   * - Only WL and MD can assign PAYIN rates (not Distributor/Retailer)
   * - PAYOUT rates are managed at Schema level by Admin only (slab-based)
   */
  async assignRate(
    assignerId: string,
    targetUserId: string,
    pgId: string,
    payinRate?: number,
    payoutRate?: number
  ) {
    // Validate assigner
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: {
        permissions: true,
      },
    });
    
    if (!assigner) {
      throw new AppError('Assigner not found', 404);
    }
    
    // Check if assigner can assign rates
    const assignerPermissions = Array.isArray(assigner.permissions) ? assigner.permissions[0] : assigner.permissions;
    const canAssign = assigner.role === 'ADMIN' ||
                      assigner.role === 'SUPER_ADMIN' ||
                      assigner.role === 'WHITE_LABEL' ||
                      assigner.role === 'MASTER_DISTRIBUTOR' ||
                      assignerPermissions?.canAssignRates;
    
    if (!canAssign) {
      throw new AppError('You do not have permission to assign rates', 403);
    }
    
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    if (assigner.role !== 'ADMIN' && assigner.role !== 'SUPER_ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only assign rates to your direct children', 403);
    }
    
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: pgId },
    });
    
    if (!pg || !pg.isActive) {
      throw new AppError('Payment gateway not available', 400);
    }
    
    // "Assign PG only" without rates when: Admin/SuperAdmin, or target user has a schema (rates from schema)
    const noPayinProvided = payinRate == null || payinRate === undefined;
    const noPayoutProvided = payoutRate == null || payoutRate === undefined;
    const noRatesProvided = noPayinProvided && (assigner.role === 'ADMIN' || assigner.role === 'SUPER_ADMIN' ? noPayoutProvided : true);
    const schemaOnly = noRatesProvided && (assigner.role === 'ADMIN' || assigner.role === 'SUPER_ADMIN' || !!targetUser.schemaId);
    
    if (schemaOnly) {
      const pgAssignment = await prisma.userPGAssignment.upsert({
        where: {
          userId_pgId: { userId: targetUserId, pgId },
        },
        update: { isEnabled: true },
        create: {
          userId: targetUserId,
          pgId,
          isEnabled: true,
        },
      });
      return {
        id: pgAssignment.id,
        userId: targetUserId,
        pgId,
        payinRate: null,
        payoutRate: null,
        assignedById: assignerId,
        isEnabled: true,
        createdAt: pgAssignment.createdAt,
        updatedAt: pgAssignment.updatedAt,
        paymentGateway: pg,
        assignedBy: assigner,
        user: targetUser,
      };
    }
    
    const payin = Number(payinRate) || 0;
    const assignerBaseRate = await this.getBaseRateForUser(assignerId, pgId);
    
    if (payin < assignerBaseRate.payinRate) {
      throw new AppError(
        `Payin rate (${(payin * 100).toFixed(2)}%) cannot be lower than your base rate (${(assignerBaseRate.payinRate * 100).toFixed(2)}%)`,
        400
      );
    }
    
    let finalPayoutRate = 0;
    if (assigner.role === 'ADMIN' || assigner.role === 'SUPER_ADMIN') {
      const payout = Number(payoutRate) ?? 0;
      if (payout < assignerBaseRate.payoutRate) {
        throw new AppError(
          `Payout rate (${(payout * 100).toFixed(2)}%) cannot be lower than your base rate (${(assignerBaseRate.payoutRate * 100).toFixed(2)}%)`,
          400
        );
      }
      finalPayoutRate = payout;
    }
    
    const pgAssignment = await prisma.userPGAssignment.upsert({
      where: {
        userId_pgId: { userId: targetUserId, pgId },
      },
      update: { isEnabled: true },
      create: {
        userId: targetUserId,
        pgId,
        isEnabled: true,
      },
    });
    
    const channels = await prisma.transactionChannel.findMany({
      where: { pgId, transactionType: 'PAYIN' },
    });
    
    for (const channel of channels) {
      await prisma.userPayinRate.upsert({
        where: {
          userId_channelId: { userId: targetUserId, channelId: channel.id },
        },
        create: {
          userId: targetUserId,
          channelId: channel.id,
          payinRate: payin,
          assignedById: assignerId,
        },
        update: {
          payinRate: payin,
          assignedById: assignerId,
          updatedAt: new Date(),
        },
      });
    }

    return {
      id: pgAssignment.id,
      userId: targetUserId,
      pgId,
      payinRate: payin,
      payoutRate: finalPayoutRate,
      assignedById: assignerId,
      isEnabled: true,
      createdAt: pgAssignment.createdAt,
      updatedAt: pgAssignment.updatedAt,
      paymentGateway: pg,
      assignedBy: assigner,
      user: targetUser,
    };
    
    /* OLD CODE - Kept for reference
    const oldRate = await prisma.userPGRate.upsert({
      where: {
        userId_pgId: { userId: targetUserId, pgId },
      },
      update: {
        payinRate,
        payoutRate: finalPayoutRate,
        assignedById: assignerId,
        isEnabled: true,
      },
      create: {
        userId: targetUserId,
        pgId,
        assignedById: assignerId,
        payinRate,
        payoutRate: finalPayoutRate,
        isEnabled: true,
      },
      include: {
        paymentGateway: {
          select: { id: true, name: true, code: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    
    // Also create/enable UserPGAssignment so the PG is available to the user
    await prisma.userPGAssignment.upsert({
      where: {
        userId_pgId: { userId: targetUserId, pgId },
      },
      update: {
        isEnabled: true,
      },
      create: {
        userId: targetUserId,
        pgId,
        isEnabled: true,
      },
    });
    
    return oldRate;
    */
  },
  
  /**
   * Get effective payin rate for a user for a PG (for display; does not throw)
   */
  async getEffectivePayinRateForUser(userId: string, pgId: string): Promise<number> {
    try {
      return await this.getUserRate(userId, pgId, 'PAYIN');
    } catch {
      return 0.02;
    }
  },

  /**
   * Get rates assigned to children of a user (for display in rate management)
   * Returns actual payin/payout rates from UserPayinRate or schema, not default only.
   */
  async getChildrenRates(userId: string, pgId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get direct children
    const children = await prisma.user.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        businessName: true,
      },
    });
    
    const defaultRate = 0.02;
    
    // Get rates for each child with actual assigned payin rate
    const childrenWithRates = await Promise.all(
      children.map(async (child) => {
        const where: any = { userId: child.id, isEnabled: true };
        if (pgId) where.pgId = pgId;
        
        const pgAssignments = await prisma.userPGAssignment.findMany({
          where,
          include: {
            paymentGateway: {
              select: { id: true, name: true, code: true, isActive: true, supportedTypes: true },
            },
          },
        });
        
        const rates = await Promise.all(
          pgAssignments.map(async (assignment) => {
            const payinRate = await this.getEffectivePayinRateForUser(child.id, assignment.pgId);
            // Payout is typically schema-level; no per-user payout in hierarchy for non-admin
            const payoutRate = defaultRate;
            return {
              id: assignment.id,
              userId: assignment.userId,
              pgId: assignment.pgId,
              payinRate,
              payoutRate,
              isEnabled: assignment.isEnabled,
              createdAt: assignment.createdAt,
              updatedAt: assignment.updatedAt,
              paymentGateway: assignment.paymentGateway,
            };
          })
        );
        
        return {
          ...child,
          rates,
        };
      })
    );
    
    return childrenWithRates;
  },
  
  /**
   * Get all available PGs for rate assignment
   * Returns PGs with the assigner's base rate (minimum they can assign)
   */
  async getAvailablePGsForAssignment(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get all active PGs
    const pgs = await prisma.paymentGateway.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    
    // Get user's rates for each PG (their minimum assignable rate)
    const pgsWithRates = await Promise.all(
      pgs.map(async (pg) => {
        const baseRate = await this.getBaseRateForUser(userId, pg.id);
        return {
          ...pg,
          minPayinRate: baseRate.payinRate,
          minPayoutRate: baseRate.payoutRate,
        };
      })
    );
    
    // Filter: only return PGs where user has a rate assigned
    // Admins always see all PGs for assignment purposes
    if (user.role === 'ADMIN') {
      return pgsWithRates;
    }
    
    // Regular users only see PGs where they have rates > 0
    return pgsWithRates.filter(pg => pg.minPayinRate > 0 || pg.minPayoutRate > 0);
  },
  
  /**
   * Toggle PG enablement for a child user
   */
  async togglePGForUser(assignerId: string, targetUserId: string, pgId: string, isEnabled: boolean) {
    // Verify permissions
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
    });
    
    if (!assigner) {
      throw new AppError('Assigner not found', 404);
    }
    
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    if (assigner.role !== 'ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only manage rates for your direct children', 403);
    }
    
    const pgAssignment = await prisma.userPGAssignment.update({
      where: {
        userId_pgId: { userId: targetUserId, pgId },
      },
      data: { isEnabled },
    });
    
    return {
      id: pgAssignment.id,
      userId: pgAssignment.userId,
      pgId: pgAssignment.pgId,
      isEnabled: pgAssignment.isEnabled,
      createdAt: pgAssignment.createdAt,
      updatedAt: pgAssignment.updatedAt,
    };
  },
  
  /**
   * Calculate commissions for a transaction based on hierarchical rates
   */
  async calculateHierarchicalCommissions(
    transactionId: string,
    initiatorId: string,
    pgId: string,
    amount: number,
    type: 'PAYIN' | 'PAYOUT',
    cardTypeId?: string
  ) {
    const breakdown: Array<{
      userId: string;
      userName: string;
      role: string;
      level: number;
      rateCharged: number;
      ratePaid: number;
      commissionRate: number;
      commissionAmount: number;
    }> = [];
    
    // Get PG base rate (or Card Type base rate)
    const pgBaseRate = 0.02; // Base is per channel (channel.baseCost); use default when no channel
    
    // Get initiator's rate (what they are charged)
    let initiatorRate: number;
    if (cardTypeId && type === 'PAYIN') {
      initiatorRate = await cardTypeService.getUserCardTypeRate(initiatorId, cardTypeId);
    } else {
      initiatorRate = await this.getUserRate(initiatorId, pgId, type);
    }
    
    // Total commission pool = initiator's rate - PG base rate
    const totalCommissionRate = initiatorRate - pgBaseRate;
    const totalCommissionAmount = amount * totalCommissionRate;
    
    // Walk up the hierarchy
    let currentUserId = initiatorId;
    let level = 0;
    let previousRate = initiatorRate; // What the previous user (child) was charged
    
    while (currentUserId) {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: {
          parent: true,
        },
      });
      
      if (!user) break;
      
      // Get this user's rate (what they pay)
      let userRate: number;
      
      if (user.role === 'ADMIN') {
        userRate = pgBaseRate;
      } else {
        if (cardTypeId && type === 'PAYIN') {
          userRate = await cardTypeService.getUserCardTypeRate(currentUserId, cardTypeId);
        } else {
          userRate = await this.getUserRate(currentUserId, pgId, type);
        }
      }
      
      // Commission = what child was charged - what this user pays
      const commissionRate = previousRate - userRate;
      
      if (commissionRate > 0) {
        const commissionAmount = amount * commissionRate;
        
        breakdown.push({
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          role: user.role,
          level,
          rateCharged: previousRate,
          ratePaid: userRate,
          commissionRate,
          commissionAmount,
        });
      }
      
      // Move up the hierarchy
      previousRate = userRate;
      currentUserId = user.parentId || '';
      level++;
      
      // Prevent infinite loops
      if (level > 10) break;
      
      // Stop at Admin level
      if (user.role === 'ADMIN') break;
    }
    
    return {
      pgBaseRate,
      initiatorRate,
      totalCommissionRate,
      totalCommissionAmount,
      breakdown,
    };
  },
  
  /**
   * Bulk assign rates to multiple children
   */
  async bulkAssignRates(
    assignerId: string,
    assignments: Array<{
      targetUserId: string;
      pgId: string;
      payinRate: number;
      payoutRate: number;
    }>
  ) {
    const results = [];
    const errors = [];
    
    for (const assignment of assignments) {
      try {
        const result = await this.assignRate(
          assignerId,
          assignment.targetUserId,
          assignment.pgId,
          assignment.payinRate,
          assignment.payoutRate
        );
        results.push(result);
      } catch (error: any) {
        errors.push({
          targetUserId: assignment.targetUserId,
          pgId: assignment.pgId,
          error: error.message,
        });
      }
    }
    
    return { results, errors };
  },

  /**
   * Get user's channel rates for a PG (with schema rates as reference)
   */
  async getUserChannelRates(requesterId: string, targetUserId: string, pgId: string) {
    // Verify requester has access (admin or parent)
    await this.verifyRateAccessPermission(requesterId, targetUserId);

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { schema: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get all channels for this PG
    const channels = await prisma.transactionChannel.findMany({
      where: { pgId, transactionType: 'PAYIN' },
      orderBy: [
        { category: 'asc' },
        { cardNetwork: 'asc' },
        { cardType: 'asc' },
      ],
    });

    // Get user's custom rates
    const userRates = await prisma.userPayinRate.findMany({
      where: {
        userId: targetUserId,
        channelId: { in: channels.map(c => c.id) },
      },
    });

    const userRateMap = new Map(userRates.map(r => [r.channelId, r]));

    // Per-channel schema rates (SchemaPayinRate); base = channel.baseCost
    const schemaRates = user.schemaId
      ? await prisma.schemaPayinRate.findMany({
          where: {
            schemaId: user.schemaId,
            channelId: { in: channels.map(c => c.id) },
          },
        })
      : [];
    const schemaRateMap = new Map(schemaRates.map(r => [r.channelId, r]));

    return channels.map(channel => {
      const userRate = userRateMap.get(channel.id);
      const schemaRow = schemaRateMap.get(channel.id);
      const channelBase = Number(channel.baseCost ?? 0.02);
      const schemaRateNum = schemaRow ? Number(schemaRow.payinRate) : channelBase;
      return {
        channelId: channel.id,
        channelName: channel.name,
        channelCode: channel.code,
        category: channel.category,
        cardNetwork: channel.cardNetwork,
        cardType: channel.cardType,
        currentRate: userRate ? Number(userRate.payinRate) : schemaRateNum,
        schemaRate: schemaRateNum,
        minRate: channelBase,
        isCustomRate: !!userRate,
        assignedById: userRate?.assignedById,
      };
    });
  },

  /**
   * Update single channel rate for a user
   */
  async updateChannelRate(
    requesterId: string,
    targetUserId: string,
    channelId: string,
    payinRate: number
  ) {
    // Verify requester has access
    await this.verifyRateAccessPermission(requesterId, targetUserId);

    // Get channel to find PG and schema rate
    const channel = await prisma.transactionChannel.findUnique({
      where: { id: channelId },
      include: { paymentGateway: true },
    });

    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { schema: true },
    });

    const channelBase = Number(channel.baseCost ?? 0.02);
    const schemaRow = user?.schemaId
      ? await prisma.schemaPayinRate.findUnique({
          where: {
            schemaId_channelId: { schemaId: user.schemaId, channelId },
          },
        })
      : null;
    const minRate = schemaRow ? Number(schemaRow.payinRate) : channelBase;

    // Validate rate is not below minimum
    if (payinRate < minRate) {
      throw new AppError(
        `Rate cannot be below ${(minRate * 100).toFixed(2)}% (schema/base rate)`,
        400
      );
    }

    // Validate requester's rate
    const requesterRate = await this.getUserRate(requesterId, channel.pgId, 'PAYIN', channelId);
    if (payinRate < requesterRate) {
      throw new AppError(
        `Rate cannot be below your own rate of ${(requesterRate * 100).toFixed(2)}%`,
        400
      );
    }

    // Create or update UserPayinRate
    const userRate = await prisma.userPayinRate.upsert({
      where: {
        userId_channelId: { userId: targetUserId, channelId },
      },
      create: {
        userId: targetUserId,
        channelId,
        payinRate,
        assignedById: requesterId,
      },
      update: {
        payinRate,
        assignedById: requesterId,
        updatedAt: new Date(),
      },
    });

    return userRate;
  },

  /**
   * Bulk update channel rates for a user
   */
  async bulkUpdateChannelRates(
    requesterId: string,
    targetUserId: string,
    pgId: string,
    rates: Array<{ channelId: string; payinRate: number }>
  ) {
    const results = [];
    const errors = [];

    for (const rateUpdate of rates) {
      try {
        const result = await this.updateChannelRate(
          requesterId,
          targetUserId,
          rateUpdate.channelId,
          rateUpdate.payinRate
        );
        results.push(result);
      } catch (error: any) {
        errors.push({
          channelId: rateUpdate.channelId,
          error: error.message,
        });
      }
    }

    return { results, errors };
  },

  /**
   * Get commission earned by user (for rate management dashboard)
   * Supports day-wise, month-wise aggregation and "from downline" breakdown
   */
  async getCommissionStats(
    userId: string,
    params: { startDate?: Date; endDate?: Date; groupBy?: 'day' | 'month' }
  ) {
    const where: any = { userId };
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const commissions = await prisma.commissionTransaction.findMany({
      where,
      include: {
        transaction: {
          select: { initiatorId: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const childIds = await userService.getAllChildIds(userId);
    const childIdSet = new Set(childIds);

    let totalEarned = 0;
    let fromDownline = 0;
    const byPeriod: Record<string, number> = {};
    const byChild: Record<string, number> = {};

    for (const c of commissions) {
      const amount = Number(c.amount);
      totalEarned += amount;
      const initiatorId = c.transaction?.initiatorId;
      if (initiatorId && childIdSet.has(initiatorId)) {
        fromDownline += amount;
        byChild[initiatorId] = (byChild[initiatorId] || 0) + amount;
      }
      const d = new Date(c.createdAt);
      const key = params.groupBy === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byPeriod[key] = (byPeriod[key] || 0) + amount;
    }

    const periodList = Object.entries(byPeriod)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Resolve child names for byChild breakdown
    const byChildList: Array<{ userId: string; userName: string; email: string; amount: number }> = [];
    if (Object.keys(byChild).length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Object.keys(byChild) } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      for (const u of users) {
        const amount = byChild[u.id] || 0;
        byChildList.push({
          userId: u.id,
          userName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          email: u.email,
          amount,
        });
      }
      byChildList.sort((a, b) => b.amount - a.amount);
    }

    return {
      totalEarned,
      fromDownline,
      byPeriod: periodList,
      byChild: byChildList,
    };
  },
};
