import prisma from '../lib/prisma';
import { CreatePGDTO, PaginationParams } from '../types';
import { AppError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';
import { channelRateService } from './channelRate.service';
import { logger } from '../utils/logger';

function normalizeSupportedTypes(val: string | null | undefined): string {
  if (val == null || val === '') return 'PAYIN, PAYOUT';
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map((t: string) => String(t).trim()).join(', ');
  } catch {
    // not JSON
  }
  const cleaned = val.replace(/["'[\]]/g, '').trim();
  if (cleaned) return cleaned.split(',').map((t) => t.trim()).filter(Boolean).join(', ');
  return 'PAYIN, PAYOUT';
}

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
        supportedTypes: data.supportedTypes == null ? undefined : (Array.isArray(data.supportedTypes) ? JSON.stringify(data.supportedTypes) : String(data.supportedTypes).trim()),
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
      const pgs = await prisma.paymentGateway.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return pgs.map((pg) => ({
        ...pg,
        supportedTypes: normalizeSupportedTypes(pg.supportedTypes),
      }));
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

    const data = pgs.map((pg) => ({
      ...pg,
      supportedTypes: normalizeSupportedTypes(pg.supportedTypes),
    }));

    return {
      data,
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
    return {
      ...pg,
      supportedTypes: normalizeSupportedTypes(pg.supportedTypes),
    };
  },

  async getAvailablePGsForUser(userId: string) {
    // First, check the user's role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, parentId: true },
    });
    
    // Admin can see all active PGs (display rate as percentage, e.g. 2 for 2%)
    const defaultRatePct = 2;
    if (user?.role === 'ADMIN') {
      const pgs = await prisma.paymentGateway.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      return pgs.map(pg => ({
        ...pg,
        supportedTypes: normalizeSupportedTypes(pg.supportedTypes),
        customPayinRate: defaultRatePct,
        customPayoutRate: defaultRatePct,
        supportsPayin: pg.supportedTypes?.includes('PAYIN') ?? true,
        supportsPayout: pg.supportedTypes?.includes('PAYOUT') ?? true,
      }));
    }

    const assignments = await prisma.userPGAssignment.findMany({
      where: { userId, isEnabled: true },
      include: {
        paymentGateway: true,
      },
    });

    if (assignments.length === 0) return [];

    let ratesByPG: Record<string, { channelName: string; channelCode: string; rate: number }[]> = {};
    try {
      ratesByPG = await channelRateService.getUserPayinRates(userId);
    } catch {
      // User has no schema or other error – use default below
    }

    return assignments
      .filter(a => a.paymentGateway.isActive)
      .map(a => {
        const pg = a.paymentGateway;
        const channels = ratesByPG[pg.code] || [];
        // Prefer "VISA normal" for display: use cardNetwork + cardType so schema rate (e.g. 1.6%) is shown, not Corporate (1.5%)
        const visaNormal =
          channels.find((c: any) => (c.cardNetwork || '').toUpperCase() === 'VISA' && (c.cardType || '').toUpperCase() === 'NORMAL')
          || channels.find(
            (c: any) => {
              const name = (c.channelName || '').toLowerCase();
              const code = (c.channelCode || '').toLowerCase();
              return (name.includes('visa') || code.includes('visa')) && (name.includes('normal') || code.includes('normal'));
            }
          )
          || channels.find((c: any) => /visa/i.test(c.channelName || '') || /visa/i.test(c.channelCode || ''));
        const firstRate = channels[0];
        const displayChannel = visaNormal || firstRate;
        const displayPayinPct = displayChannel
          ? Math.round(Number(displayChannel.rate) * 10000) / 100
          : defaultRatePct;
        // Show schema rate on the card for all PGs when available (Razorpay, Sabpaisa, etc.)
        let cardPayinPct = displayPayinPct;
        if (displayChannel?.schemaRate != null) {
          cardPayinPct = Math.round(Number(displayChannel.schemaRate) * 10000) / 100;
          if (pg.code === 'RAZORPAY') logger.info(`[Payin] RAZORPAY VISA Normal rate = ${cardPayinPct}%`);
        }
        return {
          ...pg,
          supportedTypes: normalizeSupportedTypes(pg.supportedTypes),
          customPayinRate: cardPayinPct,
          customPayoutRate: defaultRatePct,
          supportsPayin: pg.supportedTypes?.includes('PAYIN') ?? true,
          supportsPayout: pg.supportedTypes?.includes('PAYOUT') ?? true,
        };
      });
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
    // Note: SchemaPayinRate and SchemaPayoutConfig should also be cleaned up
    // but they use the new channel-based system
    
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
  
  // DEPRECATED: Old method using schemaPGRate model (removed)
  // Use transaction.service.ts getPayoutSlabs() or new channel-based system
  /*
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
  */

  // Base rate is per channel (TransactionChannel.baseCost), not per PG

  // Get all channels for a PG
  async getChannelsForPG(pgId: string) {
    const channels = await prisma.transactionChannel.findMany({
      where: { pgId },
      orderBy: [
        { category: 'asc' },
        { cardNetwork: 'asc' },
        { cardType: 'asc' },
      ],
    });

    return channels;
  },
};

