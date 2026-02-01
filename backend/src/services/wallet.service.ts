// import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { WalletTransferDTO, PaginationParams, WalletTransactionType } from '../types';
import { AppError } from '../middleware/errorHandler';
// import { WalletTransactionType } from '@prisma/client';
import { userService } from './user.service';

export const walletService = {
  async getWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    return wallet;
  },
  
  async getWalletTransactions(userId: string, params: PaginationParams & {
    type?: WalletTransactionType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const where: any = { walletId: wallet.id };
    
    if (params.type) {
      where.type = params.type;
    }
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }
    
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where }),
    ]);
    
    return {
      data: transactions,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },
  
  async transfer(requesterId: string, data: WalletTransferDTO) {
    // Check permissions
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      include: { permissions: true, wallet: true },
    });
    
    if (!requester) {
      throw new AppError('User not found', 404);
    }
    
    // permissions is an array, get the first element
    const requesterPermissions = Array.isArray(requester.permissions) ? requester.permissions[0] : requester.permissions;
    if (requester.role !== 'ADMIN' && !requesterPermissions?.canTransferWallet) {
      throw new AppError('You do not have permission to transfer funds', 403);
    }
    
    // Validate recipient
    const recipient = await prisma.user.findUnique({
      where: { id: data.toUserId },
      include: { wallet: true },
    });
    
    if (!recipient) {
      throw new AppError('Recipient not found', 404);
    }
    
    // Check hierarchy
    if (requester.role !== 'ADMIN') {
      const isInHierarchy = await userService.isInHierarchy(requesterId, data.toUserId);
      if (!isInHierarchy) {
        throw new AppError('You can only transfer to users in your hierarchy', 403);
      }
    }
    
    if (!requester.wallet || !recipient.wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const amount = Number(data.amount);
    const requesterBalance = Number(requester.wallet.balance);
    
    if (requesterBalance < amount) {
      throw new AppError('Insufficient balance', 400);
    }
    
    // Perform transfer in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Debit from sender
      const senderWallet = await tx.wallet.update({
        where: { id: requester.wallet!.id },
        data: {
          balance: { decrement: amount },
        },
      });
      
      // Create debit transaction
      await tx.walletTransaction.create({
        data: {
          walletId: requester.wallet!.id,
          type: 'TRANSFER_OUT',
          amount: -amount,
          balanceBefore: requester.wallet!.balance,
          balanceAfter: senderWallet.balance,
          description: data.description || `Transfer to ${recipient.email}`,
          referenceId: recipient.id,
          referenceType: 'USER',
        },
      });
      
      // Credit to recipient
      const recipientWallet = await tx.wallet.update({
        where: { id: recipient.wallet!.id },
        data: {
          balance: { increment: amount },
        },
      });
      
      // Create credit transaction
      await tx.walletTransaction.create({
        data: {
          walletId: recipient.wallet!.id,
          type: 'TRANSFER_IN',
          amount: amount,
          balanceBefore: recipient.wallet!.balance,
          balanceAfter: recipientWallet.balance,
          description: data.description || `Transfer from ${requester.email}`,
          referenceId: requester.id,
          referenceType: 'USER',
        },
      });
      
      return { senderBalance: senderWallet.balance, recipientBalance: recipientWallet.balance };
    });
    
    return {
      message: 'Transfer successful',
      ...result,
    };
  },
  
  async creditCommission(userId: string, amount: number, transactionId: string, description: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: decimalAmount },
        },
      });
      
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'COMMISSION',
          amount: decimalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          description,
          referenceId: transactionId,
          referenceType: 'TRANSACTION',
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
  
  async addFunds(adminId: string, userId: string, amount: number, description?: string) {
    // Only admin can add funds directly
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });
    
    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Only admin can add funds', 403);
    }
    
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: decimalAmount },
        },
      });
      
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: decimalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          description: description || 'Admin credit',
          referenceId: adminId,
          referenceType: 'ADMIN',
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
  
  async deductFunds(adminId: string, userId: string, amount: number, description?: string) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });
    
    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Only admin can deduct funds', 403);
    }
    
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    const currentBalance = Number(wallet.balance);
    
    if (currentBalance < decimalAmount) {
      throw new AppError('Insufficient balance', 400);
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: decimalAmount },
        },
      });
      
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: -decimalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          description: description || 'Admin debit',
          referenceId: adminId,
          referenceType: 'ADMIN',
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
  
  // Hold funds for payout (moves from balance to holdBalance)
  async holdFunds(userId: string, amount: number, transactionId: string, description: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    const currentBalance = Number(wallet.balance);
    
    if (currentBalance < decimalAmount) {
      throw new AppError('Insufficient balance', 400);
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: decimalAmount },
          holdBalance: { increment: decimalAmount },
        },
      });
      
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYOUT_HOLD',
          amount: -decimalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          description,
          referenceId: transactionId,
          referenceType: 'PAYOUT_HOLD',
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
  
  // Release hold on payout success (deduct from holdBalance permanently)
  async releaseHoldOnSuccess(userId: string, amount: number, transactionId: string, description: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          holdBalance: { decrement: decimalAmount },
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
  
  // Release hold on payout failure (return from holdBalance to balance)
  async releaseHoldOnFailure(userId: string, amount: number, transactionId: string, description: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    
    const decimalAmount = Number(amount);
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: decimalAmount },
          holdBalance: { decrement: decimalAmount },
        },
      });
      
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'REFUND',
          amount: decimalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: updatedWallet.balance,
          description,
          referenceId: transactionId,
          referenceType: 'PAYOUT_REFUND',
        },
      });
      
      return updatedWallet;
    });
    
    return result;
  },
};

