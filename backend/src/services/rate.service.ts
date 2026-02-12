import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { cardTypeService } from './cardType.service';

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
  async getUserRate(userId: string, pgId: string, type: 'PAYIN' | 'PAYOUT' = 'PAYIN'): Promise<number> {
    // Check if PG is assigned to user
    const pgAssignment = await prisma.userPGAssignment.findUnique({
      where: {
        userId_pgId: { userId, pgId },
      },
    });
    
    if (!pgAssignment || !pgAssignment.isEnabled) {
      throw new AppError('Payment gateway not assigned to user', 404);
    }
    
    // For now, return a default rate
    // TODO: Calculate from channel-based rates
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: pgId },
    });
    
    return pg?.baseRate || 0.02;
  },
  
  /**
   * Get all rates assigned to a user (for all PGs)
   */
  async getUserRates(userId: string) {
    const pgAssignments = await prisma.userPGAssignment.findMany({
      where: { userId, isEnabled: true },
      include: {
        paymentGateway: {
          select: { id: true, name: true, code: true, baseRate: true, isActive: true, supportedTypes: true },
        },
      },
    });
    
    // Map to old format for compatibility
    const rates = pgAssignments.map(assignment => ({
      id: assignment.id,
      userId: assignment.userId,
      pgId: assignment.pgId,
      payinRate: assignment.paymentGateway.baseRate,
      payoutRate: assignment.paymentGateway.baseRate,
      isEnabled: assignment.isEnabled,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      paymentGateway: assignment.paymentGateway,
    }));
    
    return rates;
  },
  
  /**
   * Get the base rate visible to a user (what they pay for PG)
   * - For Admin: PG's actual base rate
   * - For others: Their assigned rate (from parent)
   */
  async getBaseRateForUser(userId: string, pgId: string): Promise<{ payinRate: number; payoutRate: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Admin sees actual PG base rate
    if (user.role === 'ADMIN') {
      const pg = await prisma.paymentGateway.findUnique({
        where: { id: pgId },
      });
      return {
        payinRate: pg?.baseRate || 0,
        payoutRate: pg?.baseRate || 0,
      };
    }
    
    // Others see their assigned rate (check PG assignment)
    const pgAssignment = await prisma.userPGAssignment.findUnique({
      where: {
        userId_pgId: { userId, pgId },
      },
      include: {
        paymentGateway: true,
      },
    });
    
    if (pgAssignment && pgAssignment.isEnabled) {
      return {
        payinRate: pgAssignment.paymentGateway.baseRate,
        payoutRate: pgAssignment.paymentGateway.baseRate,
      };
    }
    
    // No rate assigned - return 0 (user cannot use this PG)
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
    payinRate: number,
    payoutRate: number = 0 // Payout rate is ignored for non-admins
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
    // permissions is an array, get the first element
    const assignerPermissions = Array.isArray(assigner.permissions) ? assigner.permissions[0] : assigner.permissions;
    const canAssign = assigner.role === 'ADMIN' || 
                      assigner.role === 'WHITE_LABEL' || 
                      assigner.role === 'MASTER_DISTRIBUTOR' ||
                      assignerPermissions?.canAssignRates;
    
    if (!canAssign) {
      throw new AppError('You do not have permission to assign rates', 403);
    }
    
    // Validate target user exists and is a child of assigner
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    // Check hierarchy - target must be direct child or Admin can assign to anyone
    if (assigner.role !== 'ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only assign rates to your direct children', 403);
    }
    
    // Get assigner's rate for this PG (their cost)
    const assignerBaseRate = await this.getBaseRateForUser(assignerId, pgId);
    
    // Validate PAYIN rate - must be >= assigner's rate
    if (payinRate < assignerBaseRate.payinRate) {
      throw new AppError(
        `Payin rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than your base rate (${(assignerBaseRate.payinRate * 100).toFixed(2)}%)`,
        400
      );
    }
    
    // PAYOUT rates are managed at Schema level by Admin only
    // Non-admin users cannot set payout rates - they are determined by schema slabs
    let finalPayoutRate = 0;
    if (assigner.role === 'ADMIN') {
      // Admin can set payout rate (percentage based) if needed
      if (payoutRate < assignerBaseRate.payoutRate) {
        throw new AppError(
          `Payout rate (${(payoutRate * 100).toFixed(2)}%) cannot be lower than your base rate (${(assignerBaseRate.payoutRate * 100).toFixed(2)}%)`,
          400
        );
      }
      finalPayoutRate = payoutRate;
    }
    // For non-admin, payoutRate stays at 0 - actual payout charges come from schema slabs
    
    // Validate PG exists and is active
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: pgId },
    });
    
    if (!pg || !pg.isActive) {
      throw new AppError('Payment gateway not available', 400);
    }
    
    // Create or update PG assignment
    const pgAssignment = await prisma.userPGAssignment.upsert({
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

    // For now, return a compatible response structure
    // TODO: Migrate to channel-based rate assignment
    const rate = {
      id: pgAssignment.id,
      userId: targetUserId,
      pgId,
      payinRate,
      payoutRate: finalPayoutRate,
      assignedById: assignerId,
      isEnabled: true,
      createdAt: pgAssignment.createdAt,
      updatedAt: pgAssignment.updatedAt,
      paymentGateway: pg,
      assignedBy: assigner,
      user: targetUser,
    };
    
    return rate;
    
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
        userId: targetUserId,
        pgId,
        isEnabled: true,
      },
    });
    
    return rate;
  },
  
  /**
   * Get rates assigned to children of a user (for display in rate management)
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
    
    // Get rates for each child
    const childrenWithRates = await Promise.all(
      children.map(async (child) => {
        const where: any = { userId: child.id, isEnabled: true };
        if (pgId) where.pgId = pgId;
        
        const pgAssignments = await prisma.userPGAssignment.findMany({
          where,
          include: {
            paymentGateway: {
              select: { id: true, name: true, code: true, isActive: true, supportedTypes: true, baseRate: true },
            },
          },
        });
        
        // Map to old rate format for compatibility
        const rates = pgAssignments.map(assignment => ({
          id: assignment.id,
          userId: assignment.userId,
          pgId: assignment.pgId,
          payinRate: assignment.paymentGateway.baseRate,
          payoutRate: assignment.paymentGateway.baseRate,
          isEnabled: assignment.isEnabled,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
          paymentGateway: assignment.paymentGateway,
        }));
        
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
    let pgBaseRate = 0.02;

    if (cardTypeId) {
       const cardType = await prisma.cardType.findUnique({ where: { id: cardTypeId } });
       if (cardType) {
         pgBaseRate = cardType.baseRate;
       } else {
         const pg = await prisma.paymentGateway.findUnique({ where: { id: pgId } });
         if (pg) pgBaseRate = pg.baseRate;
       }
    } else {
       const pg = await prisma.paymentGateway.findUnique({ where: { id: pgId } });
       if (!pg) {
         throw new AppError('Payment gateway not found', 404);
       }
       pgBaseRate = pg.baseRate;
    }
    
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
};
