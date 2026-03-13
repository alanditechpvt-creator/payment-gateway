import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/** Global ledger and export are capped to this many months (1 year 6 months) to avoid unbounded queries */
const MAX_GLOBAL_LEDGER_MONTHS = 18;

function clampGlobalLedgerDateRange(startDate?: Date, endDate?: Date): { startDate: Date; endDate: Date } {
  const now = new Date();
  const capMs = MAX_GLOBAL_LEDGER_MONTHS * 30 * 24 * 60 * 60 * 1000; // ~18 months in ms

  if (!startDate && !endDate) {
    const end = new Date(now);
    const start = new Date(now.getTime() - capMs);
    return { startDate: start, endDate: end };
  }
  if (startDate && !endDate) {
    const end = new Date(Math.min(now.getTime(), startDate.getTime() + capMs));
    return { startDate, endDate: end };
  }
  if (!startDate && endDate) {
    const start = new Date(endDate.getTime() - capMs);
    return { startDate: start, endDate };
  }
  // Both provided: clamp range to 18 months (anchor end date)
  const start = startDate!;
  const end = endDate!;
  if (end.getTime() - start.getTime() > capMs) {
    return { startDate: new Date(end.getTime() - capMs), endDate: end };
  }
  return { startDate: start, endDate: end };
}

export interface LedgerEntry {
  id: string;
  date: Date;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  referenceId: string | null;
  referenceType: string | null;
}

export interface LedgerSummary {
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  transactionCount: number;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  summary: LedgerSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const ledgerService = {
  async getUserLedger(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      type?: string;
      search?: string;
    }
  ): Promise<LedgerResponse> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    
    // Get wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    // Build where clause
    const where: any = { walletId: wallet.id };
    
    if (params.type) {
      where.type = params.type;
    }
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }
    
    if (params.search) {
      where.OR = [
        { description: { contains: params.search } },
        { referenceId: { contains: params.search } },
      ];
    }
    
    // Get total count
    const total = await prisma.walletTransaction.count({ where });
    
    // Get transactions with pagination
    const transactions = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    // Summary using aggregates (avoids fetching all rows)
    const summaryWhere: any = { walletId: wallet.id };
    if (params.startDate || params.endDate) {
      summaryWhere.createdAt = {};
      if (params.startDate) summaryWhere.createdAt.gte = params.startDate;
      if (params.endDate) summaryWhere.createdAt.lte = params.endDate;
    }

    const [creditSum, debitSum, firstInRange] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: { ...summaryWhere, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { ...summaryWhere, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.findFirst({
        where: summaryWhere,
        orderBy: { createdAt: 'asc' },
        select: { balanceBefore: true },
      }),
    ]);

    const totalCredits = Number(creditSum._sum?.amount ?? 0);
    const totalDebits = Math.abs(Number(debitSum._sum?.amount ?? 0));
    const openingBalance = firstInRange != null ? Number(firstInRange.balanceBefore) : 0;
    
    const closingBalance = Number(wallet.balance);
    
    // Transform transactions to ledger entries
    const entries: LedgerEntry[] = transactions.map((tx) => {
      const amount = Number(tx.amount);
      return {
        id: tx.id,
        date: tx.createdAt,
        type: tx.type,
        description: tx.description || getDefaultDescription(tx.type, tx.referenceType),
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: Number(tx.balanceAfter),
        referenceId: tx.referenceId,
        referenceType: tx.referenceType,
      };
    });
    
    return {
      entries,
      summary: {
        openingBalance,
        totalCredits,
        totalDebits,
        closingBalance,
        transactionCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
  
  async getGlobalLedger(
    params: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      type?: string;
      userId?: string;
      search?: string;
    }
  ): Promise<any> {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const { startDate: clampedStart, endDate: clampedEnd } = clampGlobalLedgerDateRange(
      params.startDate,
      params.endDate
    );
    
    // Build where clause (global ledger capped at 18 months)
    const where: any = {};
    
    if (params.type) {
      where.type = params.type;
    }
    
    where.createdAt = { gte: clampedStart, lte: clampedEnd };
    
    if (params.userId) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: params.userId },
      });
      if (wallet) {
        where.walletId = wallet.id;
      }
    }
    
    if (params.search) {
      where.OR = [
        { description: { contains: params.search } },
        { referenceId: { contains: params.search } },
      ];
    }

    // Get total count
    const total = await prisma.walletTransaction.count({ where });

    // Debug: count by type in this range (so we can see if COMMISSION rows exist)
    const byType = await prisma.walletTransaction.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
    });
    logger.info(`[GlobalLedger] query range=${clampedStart.toISOString()} to ${clampedEnd.toISOString()} typeFilter=${params.type ?? 'all'} total=${total} byType=${JSON.stringify(byType.map((t) => ({ type: t.type, count: t._count.id })))}`);

    // Get transactions with pagination
    const transactions = await prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get summary aggregates
    const creditSum = await prisma.walletTransaction.aggregate({
      where: { ...where, amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const debitSum = await prisma.walletTransaction.aggregate({
      where: { ...where, amount: { lt: 0 } },
      _sum: { amount: true },
    });
    
    // Transform transactions
    const entries = transactions.map((tx) => {
      const amount = Number(tx.amount);
      return {
        id: tx.id,
        date: tx.createdAt,
        type: tx.type,
        description: tx.description || getDefaultDescription(tx.type, tx.referenceType),
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: Number(tx.balanceAfter),
        referenceId: tx.referenceId,
        referenceType: tx.referenceType,
        user: tx.wallet.user,
      };
    });
    
    return {
      entries,
      summary: {
        totalCredits: Number(creditSum._sum.amount || 0),
        totalDebits: Math.abs(Number(debitSum._sum.amount || 0)),
        transactionCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async exportGlobalLedger(params: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    userId?: string;
    format?: 'json' | 'csv';
  }) {
    const { startDate: clampedStart, endDate: clampedEnd } = clampGlobalLedgerDateRange(
      params.startDate,
      params.endDate
    );
    const where: any = { createdAt: { gte: clampedStart, lte: clampedEnd } };
    if (params.type) where.type = params.type;
    if (params.userId) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: params.userId },
      });
      if (wallet) where.walletId = wallet.id;
    }
    const transactions = await prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const entries = transactions.map((tx) => {
      const amount = Number(tx.amount);
      const user = tx.wallet?.user;
      const userLabel = user
        ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email) || user.email
        : '';
      return {
        date: tx.createdAt,
        type: tx.type,
        description: tx.description || getDefaultDescription(tx.type, tx.referenceType),
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        balance: Number(tx.balanceAfter),
        referenceId: tx.referenceId,
        userEmail: user?.email,
        userName: userLabel,
      };
    });
    const dateStr = new Date().toISOString().split('T')[0];
    if (params.format === 'csv') {
      const headers = ['Date', 'User', 'Email', 'Type', 'Description', 'Debit', 'Credit', 'Balance', 'Reference'];
      const rows = entries.map((e) =>
        [
          e.date.toISOString(),
          e.userName,
          e.userEmail || '',
          e.type,
          e.description,
          e.debit.toFixed(2),
          e.credit.toFixed(2),
          e.balance.toFixed(2),
          e.referenceId || '',
        ].join(',')
      );
      return {
        filename: `global-ledger_${dateStr}.csv`,
        content: [headers.join(','), ...rows].join('\n'),
        contentType: 'text/csv',
      };
    }
    return {
      filename: `global-ledger_${dateStr}.json`,
      content: JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          filters: {
            startDate: clampedStart.toISOString(),
            endDate: clampedEnd.toISOString(),
            type: params.type,
            userId: params.userId,
            note: MAX_GLOBAL_LEDGER_MONTHS < 24 ? `Date range capped at ${MAX_GLOBAL_LEDGER_MONTHS} months` : undefined,
          },
          entries,
        },
        null,
        2
      ),
      contentType: 'application/json',
    };
  },
  
  async exportLedger(
    userId: string,
    params: {
      startDate?: Date;
      endDate?: Date;
      format?: 'json' | 'csv';
    }
  ) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const where: any = { walletId: wallet.id };
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }
    
    const transactions = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    
    if (params.format === 'csv') {
      const headers = ['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance', 'Reference'];
      const rows = transactions.map((tx) => {
        const amount = Number(tx.amount);
        return [
          tx.createdAt.toISOString(),
          tx.type,
          tx.description || '',
          amount < 0 ? Math.abs(amount).toFixed(2) : '',
          amount > 0 ? amount.toFixed(2) : '',
          Number(tx.balanceAfter).toFixed(2),
          tx.referenceId || '',
        ].join(',');
      });
      
      return {
        filename: `ledger_${wallet.user.email}_${new Date().toISOString().split('T')[0]}.csv`,
        content: [headers.join(','), ...rows].join('\n'),
        contentType: 'text/csv',
      };
    }
    
    // JSON format
    return {
      filename: `ledger_${wallet.user.email}_${new Date().toISOString().split('T')[0]}.json`,
      content: JSON.stringify({
        user: wallet.user,
        generatedAt: new Date().toISOString(),
        entries: transactions.map((tx) => ({
          date: tx.createdAt,
          type: tx.type,
          description: tx.description,
          amount: Number(tx.amount),
          balanceBefore: Number(tx.balanceBefore),
          balanceAfter: Number(tx.balanceAfter),
          reference: tx.referenceId,
        })),
      }, null, 2),
      contentType: 'application/json',
    };
  },
};

function getDefaultDescription(type: string, referenceType: string | null): string {
  const descriptions: Record<string, string> = {
    CREDIT: 'Wallet credit',
    DEBIT: referenceType === 'PAYOUT_HOLD' ? 'Payout hold' : 'Wallet debit',
    COMMISSION: 'Commission earned',
    TRANSFER_IN: 'Funds received',
    TRANSFER_OUT: 'Funds transferred',
    REFUND: 'Refund credited',
  };
  return descriptions[type] || type;
}

