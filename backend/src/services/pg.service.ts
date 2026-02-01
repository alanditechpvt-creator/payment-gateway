import prisma from '../lib/prisma';
import { CreatePGDTO, PaginationParams } from '../types';
import { AppError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';

export const pgService = {
  async createPG(data: CreatePGDTO) {
    const pg = await prisma.paymentGateway.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        merchantId: data.merchantId,
        webhookSecret: data.webhookSecret,
        configuration: data.configuration ? JSON.stringify(data.configuration) : null,
        baseRate: Number(data.baseRate),
        minAmount: data.minAmount ? Number(data.minAmount) : null,
        maxAmount: data.maxAmount ? Number(data.maxAmount) : null,
        supportedTypes: JSON.stringify(data.supportedTypes || ['PAYIN', 'PAYOUT']),
      },
    });
    
    return pg;
  },
  
  async updatePG(pgId: string, data: Partial<CreatePGDTO> & { isActive?: boolean }) {
    const pg = await prisma.paymentGateway.update({
      where: { id: pgId },
      data: {
        name: data.name,
        description: data.description,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        merchantId: data.merchantId,
        webhookSecret: data.webhookSecret,
        configuration: data.configuration ? JSON.stringify(data.configuration) : undefined,
        isActive: data.isActive,
        baseRate: data.baseRate ? Number(data.baseRate) : undefined,
        minAmount: data.minAmount !== undefined ? (data.minAmount ? Number(data.minAmount) : null) : undefined,
        maxAmount: data.maxAmount !== undefined ? (data.maxAmount ? Number(data.maxAmount) : null) : undefined,
        supportedTypes: data.supportedTypes ? JSON.stringify(data.supportedTypes) : undefined,
      },
    });
    
    return pg;
  },
  
  async getPGs(params?: PaginationParams & { isActive?: boolean }) {
    const where: any = {};
    
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    
    if (!params) {
      return prisma.paymentGateway.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    }
    
    const [pgs, total] = await Promise.all([
      prisma.paymentGateway.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { [params.sortBy || 'name']: params.sortOrder || 'asc' },
      }),
      prisma.paymentGateway.count({ where }),
    ]);
    
    return {
      data: pgs,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },
  
  async getPGById(pgId: string) {
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: pgId },
    });
    
    if (!pg) {
      throw new AppError('Payment gateway not found', 404);
    }
    
    return pg;
  },
  
  async getAvailablePGsForUser(userId: string) {
    // First, check the user's role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, parentId: true },
    });
    
    // Admin can see all active PGs
    if (user?.role === 'ADMIN') {
      const pgs = await prisma.paymentGateway.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      return pgs.map(pg => ({
        ...pg,
        customPayinRate: pg.baseRate,
        customPayoutRate: pg.baseRate,
        supportsPayin: pg.supportedTypes?.includes('PAYIN') ?? true,
        supportsPayout: pg.supportedTypes?.includes('PAYOUT') ?? true,
      }));
    }
    
    // For other users, check their specific assignments
    const assignments = await prisma.userPGAssignment.findMany({
      where: { userId, isEnabled: true },
      include: {
        paymentGateway: true,
      },
    });
    
    // If user has specific assignments, use those
    if (assignments.length > 0) {
      return assignments
        .filter(a => a.paymentGateway.isActive)
        .map(a => ({
          ...a.paymentGateway,
          customPayinRate: a.customPayinRate || a.paymentGateway.baseRate,
          customPayoutRate: a.customPayoutRate || a.paymentGateway.baseRate,
          supportsPayin: a.paymentGateway.supportedTypes?.includes('PAYIN') ?? true,
          supportsPayout: a.paymentGateway.supportedTypes?.includes('PAYOUT') ?? true,
        }));
    }
    
    // Fallback: If no assignments, check if user's schema has PG rates
    const userWithSchema = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        schema: {
          include: {
            pgRates: {
              include: { paymentGateway: true },
            },
          },
        },
      },
    });
    
    if (userWithSchema?.schema?.pgRates?.length) {
      return userWithSchema.schema.pgRates
        .filter(r => r.paymentGateway.isActive)
        .map(r => ({
          ...r.paymentGateway,
          customPayinRate: r.payinRate,
          customPayoutRate: r.payoutRate,
          supportsPayin: r.paymentGateway.supportedTypes?.includes('PAYIN') ?? true,
          supportsPayout: r.paymentGateway.supportedTypes?.includes('PAYOUT') ?? true,
        }));
    }
    
    // Final fallback for development: return all active PGs
    const allActivePGs = await prisma.paymentGateway.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    
    return allActivePGs.map(pg => ({
      ...pg,
      customPayinRate: pg.baseRate,
      customPayoutRate: pg.baseRate,
      supportsPayin: pg.supportedTypes?.includes('PAYIN') ?? true,
      supportsPayout: pg.supportedTypes?.includes('PAYOUT') ?? true,
    }));
  },
  
  async togglePGStatus(pgId: string, isActive: boolean) {
    const pg = await prisma.paymentGateway.update({
      where: { id: pgId },
      data: { isActive },
    });
    
    return pg;
  },
  
  async deletePG(pgId: string) {
    // Check if PG has transactions
    const transactionCount = await prisma.transaction.count({
      where: { pgId },
    });
    
    if (transactionCount > 0) {
      throw new AppError('Cannot delete PG with existing transactions. Deactivate instead.', 400);
    }
    
    // Delete assignments first
    await prisma.userPGAssignment.deleteMany({ where: { pgId } });
    await prisma.schemaPGRate.deleteMany({ where: { pgId } });
    
    await prisma.paymentGateway.delete({ where: { id: pgId } });
    
    return { message: 'Payment gateway deleted' };
  },
  
  async getPGStats(pgId: string, startDate?: Date, endDate?: Date) {
    const where: any = { pgId, status: 'SUCCESS' };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    
    const [payinStats, payoutStats, userCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, type: 'PAYIN' },
        _sum: { amount: true, pgCharges: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'PAYOUT' },
        _sum: { amount: true, pgCharges: true },
        _count: true,
      }),
      prisma.userPGAssignment.count({
        where: { pgId, isEnabled: true },
      }),
    ]);
    
    return {
      payin: {
        count: payinStats._count,
        totalAmount: payinStats._sum.amount || 0,
        totalCharges: payinStats._sum.pgCharges || 0,
      },
      payout: {
        count: payoutStats._count,
        totalAmount: payoutStats._sum.amount || 0,
        totalCharges: payoutStats._sum.pgCharges || 0,
      },
      activeUsers: userCount,
    };
  },
  
  // Get payout slabs for a user based on their schema
  async getPayoutSlabsForUser(userId: string, pgId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        schema: {
          include: {
            pgRates: {
              where: { pgId },
              include: {
                payoutSlabs: {
                  orderBy: { minAmount: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    
    // Get slabs from user's schema-PG rate
    const schemaPGRate = user?.schema?.pgRates?.[0];
    
    if (schemaPGRate?.payoutSlabs?.length) {
      return {
        chargeType: schemaPGRate.payoutChargeType,
        payoutRate: schemaPGRate.payoutRate,
        slabs: schemaPGRate.payoutSlabs,
      };
    }
    
    // Return default slabs
    return {
      chargeType: 'SLAB',
      payoutRate: 0,
      slabs: [
        { id: 'default-1', minAmount: 0, maxAmount: 10000, flatCharge: 10 },
        { id: 'default-2', minAmount: 10001, maxAmount: 50000, flatCharge: 12 },
        { id: 'default-3', minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
        { id: 'default-4', minAmount: 200001, maxAmount: null, flatCharge: 25 },
      ],
    };
  },
};

