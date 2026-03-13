import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { CreateTransactionDTO, PaginationParams, ROLE_HIERARCHY } from '../types';
import { AppError } from '../middleware/errorHandler';
// Define types locally since they are strings in Prisma schema
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
export type TransactionType = 'PAYIN' | 'PAYOUT' | 'CC_PAYMENT';
import { walletService } from './wallet.service';
import { userService } from './user.service';
import { runpaisaService } from './runpaisa.service';
import { cashfreeService } from './cashfree.service';
import { rateService } from './rate.service';
import { channelRateService } from './channelRate.service';
import { razorpayService } from './razorpay.service';
import { logger } from '../utils/logger';
import { config } from '../config';

export const transactionService = {
  async createTransaction(userId: string, data: CreateTransactionDTO) {
    // Verify user permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        schema: {
          include: {
            payinRates: {
              where: { pgId: data.pgId },
            },
          },
        },
        pgAssignments: {
          where: { pgId: data.pgId, isEnabled: true },
        },
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check transaction permissions
    // Default to allowing if no permissions are explicitly set
    // permissions is an array, get the first element
    const userPermissions = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
    const permissionKey = data.type === 'PAYIN' ? 'canInitiatePayin' : 'canInitiatePayout';
    const hasPermission = !userPermissions || (userPermissions as any)[permissionKey] !== false;
    
    // Also allow for ADMIN, WHITE_LABEL, MASTER_DISTRIBUTOR roles by default
    const allowedRoles = ['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'];
    if (!hasPermission && !allowedRoles.includes(user.role)) {
      throw new AppError(`You do not have permission to initiate ${data.type.toLowerCase()} transactions`, 403);
    }
    
    // Get PG details
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: data.pgId },
    });
    
    if (!pg || !pg.isActive) {
      throw new AppError('Payment gateway not available', 400);
    }
    
    // Check amount limits
    const amount = new Decimal(data.amount);
    if (pg.minAmount && amount.lessThan(pg.minAmount)) {
      throw new AppError(`Minimum amount is ${pg.minAmount}`, 400);
    }
    if (pg.maxAmount && amount.greaterThan(pg.maxAmount)) {
      throw new AppError(`Maximum amount is ${pg.maxAmount}`, 400);
    }
    
    // Get user's rate from hierarchical rate assignment
    const userRate = await rateService.getUserRate(userId, data.pgId, data.type);
    
    // Calculate charges based on transaction type
    let pgCharges: Decimal;
    let chargeDetails: any = {};
    
    if (data.type === 'PAYIN') {
      // PAYIN: Percentage based on user's assigned rate
      const payinRate = userRate ?? 0.02;
      pgCharges = amount.mul(payinRate);
      chargeDetails = { 
        type: 'PERCENTAGE', 
        rate: payinRate,
        rateDisplay: `${(payinRate * 100).toFixed(2)}%`,
      };
    } else {
      // PAYOUT: Global Slab-based configuration
      
      // 1. Get Global Payout Configuration
      const globalSettings = await prisma.systemSettings.findMany({
        where: { key: { in: ['GLOBAL_PAYOUT_PG_ID', 'GLOBAL_PAYOUT_SLABS'] } }
      });
      
      const activePgId = globalSettings.find(s => s.key === 'GLOBAL_PAYOUT_PG_ID')?.value;
      const slabsJson = globalSettings.find(s => s.key === 'GLOBAL_PAYOUT_SLABS')?.value;
      
      if (!activePgId) {
        throw new AppError('Global payout configuration missing (Active PG). Please contact support.', 500);
      }
      
      // Verify the requested PG is the active global payout PG
      if (data.pgId !== activePgId) {
        throw new AppError('Invalid Payment Gateway for Payout. Please use the active payout gateway.', 400);
      }
      
      // Use global slabs; if empty use default (0-50k = ₹10 as per applicable PG)
      const rawSlabs = slabsJson ? JSON.parse(slabsJson) : [];
      const slabs = Array.isArray(rawSlabs) && rawSlabs.length > 0
        ? rawSlabs
        : [
            { minAmount: 0, maxAmount: 50000, flatCharge: 10 },
            { minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
            { minAmount: 200001, maxAmount: null, flatCharge: 25 },
          ];
      
      // 2. Calculate charges based on Global Slabs
      const applicableSlab = slabs.find((slab: any) => 
        Number(amount) >= slab.minAmount && 
        (slab.maxAmount === null || slab.maxAmount === undefined || Number(amount) <= slab.maxAmount)
      );
      
      if (applicableSlab) {
        pgCharges = new Decimal(applicableSlab.flatCharge);
        chargeDetails = { 
          type: 'SLAB', 
          flatCharge: applicableSlab.flatCharge,
          slab: `₹${Number(applicableSlab.minAmount).toLocaleString()} - ${applicableSlab.maxAmount ? '₹' + Number(applicableSlab.maxAmount).toLocaleString() : 'Above'}`
        };
      } else {
        // No matching slab: use highest slab (e.g. amount above last max) or first slab as fallback
        const sorted = [...slabs].sort((a: any, b: any) => (b.minAmount ?? 0) - (a.minAmount ?? 0));
        const fallbackSlab = sorted[0];
        pgCharges = fallbackSlab ? new Decimal(fallbackSlab.flatCharge) : new Decimal(10);
        chargeDetails = { 
          type: 'SLAB', 
          flatCharge: Number(pgCharges),
          slab: 'Default'
        };
      }
    }
    
    // For PAYIN: netAmount = amount - charges (what user gets after PG deduction)
    // For PAYOUT: netAmount = amount (what beneficiary receives), totalDeduction = amount + charges
    const netAmount = data.type === 'PAYIN' ? amount.sub(pgCharges) : amount;
    const totalDeduction = (data.type === 'PAYOUT' || data.type === 'CC_PAYMENT') ? amount.add(pgCharges) : amount;
    
    // For PAYOUT and CC_PAYMENT, check wallet balance
    if (data.type === 'PAYOUT' || data.type === 'CC_PAYMENT') {
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
      });
      
      if (!wallet || wallet.balance < Number(totalDeduction)) {
        throw new AppError(`Insufficient wallet balance. Required: ₹${totalDeduction.toFixed(2)}, Available: ₹${wallet?.balance?.toFixed(2) || '0.00'}`, 400);
      }
    }
    
    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        transactionId,
        type: data.type,
        amount: Number(amount),
        pgCharges: Number(pgCharges),
        platformCommission: 0, // Will be calculated on completion
        netAmount: Number(netAmount),
        initiatorId: userId,
        pgId: data.pgId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        beneficiaryId: data.beneficiaryId,
        beneficiaryName: data.beneficiaryName,
        beneficiaryAccount: data.beneficiaryAccount,
        beneficiaryIfsc: data.beneficiaryIfsc,
        locationLatitude: data.locationLatitude ?? null,
        locationLongitude: data.locationLongitude ?? null,
        locationAccuracyM: data.locationAccuracyM ?? null,
        locationSource: data.locationSource ?? null,
        status: 'PENDING',
      },
      include: {
        paymentGateway: {
          select: { id: true, name: true, code: true },
        },
        beneficiary: true,
      },
    });
    
    // For PAYOUT, hold the amount in wallet (will be released on success/failure)
    if (data.type === 'PAYOUT') {
      await walletService.holdFunds(
        userId,
        Number(totalDeduction),
        transaction.id,
        `Payout hold for ${transactionId} (Amount: ₹${amount}, Charges: ₹${pgCharges.toFixed(2)})`
      );
    }
    
    // Generate payment link for PAYIN transactions
    let paymentLink: string | null = null;
    let pgOrderId: string | null = null;
    let pgOrderToken: string | null = null;
    
    if (data.type === 'PAYIN') {
      const pgCode = pg.code.toUpperCase();
      
      // Use actual PG integration if available
      if (pgCode === 'RUNPAISA' && runpaisaService.isConfigured()) {
        logger.info(`Creating Runpaisa order for transaction: ${transactionId}`);
        
        const runpaisaResult = await runpaisaService.createOrder({
          orderId: transactionId,
          amount: Number(amount),
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          merchantRef: user.email,
        });
        
        if (runpaisaResult.success && runpaisaResult.paymentLink) {
          paymentLink = runpaisaResult.paymentLink;
          pgOrderId = runpaisaResult.orderId || null;
          pgOrderToken = runpaisaResult.orderToken || null;
          
          // Update transaction with PG reference
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              pgTransactionId: pgOrderId,
              pgResponse: JSON.stringify({
                order_token: pgOrderToken,
                order_id: pgOrderId,
                created_at: new Date().toISOString(),
              }),
            },
          });
          
          logger.info(`Runpaisa payment link generated: ${paymentLink}`);
        } else {
          logger.error(`Runpaisa order creation failed: ${runpaisaResult.error}`);
          // Fall back to demo link if Runpaisa fails
          paymentLink = `https://pay.runpaisa.com/demo/${transactionId}`;
        }
      } else if (pgCode === 'SABPAISA' && config.sabpaisa.enabled) {
        logger.info(`Generating SabPaisa link for transaction: ${transactionId}`);
        
        // Construct the backend "payment page" URL
        // In production, this should be the public URL of the backend
        const baseUrl = process.env.BACKEND_URL || 
                       (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : null) || 
                       'http://localhost:4100';
        paymentLink = `${baseUrl}/api/sabpaisa/pay/${transaction.id}`;
        
        // Update transaction
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            pgResponse: JSON.stringify({ 
              created_at: new Date().toISOString(), 
              type: 'SABPAISA_REDIRECT',
              link: paymentLink 
            }),
          },
        });
      } else {
        // Use Cashfree integration if configured
        if (pgCode === 'CASHFREE' && cashfreeService.isEnabled()) {
          logger.info(`Creating Cashfree order for transaction: ${transactionId}`);
          const cfResult = await cashfreeService.createOrder({
            orderId: transactionId,
            amount: Number(amount),
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
            returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/pg-return`,
          });

          if (cfResult.success) {
            paymentLink = `https://payments.cashfree.com/order/${cfResult.cfOrderId || transactionId}`;
            pgOrderId = cfResult.orderId || null;

            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                pgTransactionId: pgOrderId,
                pgResponse: JSON.stringify({ created_at: new Date().toISOString(), raw: cfResult }),
              },
            });

            logger.info(`Cashfree order created: ${pgOrderId}`);
          } else {
            logger.error(`Cashfree order creation failed: ${cfResult.error}`);
            paymentLink = `https://payments.cashfree.com/order/${transactionId}`; // fallback
          }
        } else if (pgCode === 'RAZORPAY' && razorpayService.isEnabled()) {
          logger.info(`Creating Razorpay order for transaction: ${transactionId}`);
          const rpResult = await razorpayService.createOrder({
            orderId: transactionId,
            amount: Number(amount) * 100, // Amount in paise
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
          });

          if (rpResult.success && rpResult.orderId) {
            paymentLink = rpResult.paymentLink || null;
            pgOrderId = rpResult.orderId;

            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                pgTransactionId: pgOrderId,
                pgResponse: JSON.stringify({ created_at: new Date().toISOString(), raw: rpResult }),
              },
            });
            
            logger.info(`Razorpay order created: ${pgOrderId}`);
          } else {
            logger.error(`Razorpay order creation failed: ${rpResult.error}`);
            // Fallback to mock if creation fails, or let it be null to trigger error?
            // If we throw error here, the transaction is already created but failed to get link.
            // Better to throw error so frontend knows.
            throw new AppError(`Failed to create Razorpay order: ${rpResult.error}`, 500);
          }
        } else {
          // Mock payment links for other PGs in development
          switch (pgCode.toLowerCase()) {
            case 'razorpay':
              paymentLink = `https://pages.razorpay.com/pl_demo/${transactionId}`;
              break;
            case 'payu':
              paymentLink = `https://payu.in/pay/${transactionId}`;
              break;
            case 'cashfree':
              paymentLink = `https://payments.cashfree.com/order/${transactionId}`;
              break;
            case 'paytm':
              paymentLink = `https://securegw.paytm.in/order/${transactionId}`;
              break;
            default:
              paymentLink = `https://pay.example.com/${transactionId}`;
          }
        }
      }
    }
    
    return {
      ...transaction,
      paymentLink,
      pgOrderId,
      totalDeduction: (data.type === 'PAYOUT' || data.type === 'CC_PAYMENT') ? Number(totalDeduction) : null,
      chargeDetails,
      charges: Number(pgCharges),
    };
  },
  
  // Get payout slabs for a schema-PG combination
  async getPayoutSlabs(schemaId: string | null, pgId: string) {
    if (!schemaId) {
      // Return default slabs if no schema assigned
      return this.getDefaultPayoutSlabs();
    }
    
    // Use new SchemaPayoutConfig model
    const payoutConfig = await prisma.schemaPayoutConfig.findUnique({
      where: {
        schemaId_pgId: { schemaId, pgId },
      },
      include: {
        slabs: {
          orderBy: { minAmount: 'asc' },
        },
      },
    });
    
    if (!payoutConfig || payoutConfig.slabs.length === 0) {
      return this.getDefaultPayoutSlabs();
    }
    
    return payoutConfig.slabs;
  },
  
  // Default payout slabs
  getDefaultPayoutSlabs() {
    return [
      { minAmount: 0, maxAmount: 10000, flatCharge: 10 },
      { minAmount: 10001, maxAmount: 50000, flatCharge: 12 },
      { minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
      { minAmount: 200001, maxAmount: null, flatCharge: 25 },
    ];
  },
  
  async processTransaction(transactionId: string, pgResponse: any, success: boolean) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { initiator: true },
    });
    
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    if (transaction.status !== 'PENDING' && transaction.status !== 'PROCESSING') {
      throw new AppError('Transaction already processed', 400);
    }
    
    if (!success) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          pgResponse: typeof pgResponse === 'string' ? pgResponse : JSON.stringify(pgResponse),
          completedAt: new Date(),
        },
      });
      return { message: 'Transaction failed' };
    }

    // For PAYIN: resolve initiator's rate from channel (specific channel if detected, else PG's "Other Payment Methods" default channel)
    let initiatorCharge = 0;
    let payinCreditAmount = Number(transaction.amount);
    let initiatorRateUsed = 0;
    let effectiveChannelId: string | null = transaction.channelId;
    if (transaction.type === 'PAYIN') {
      try {
        let channelIdToUse = transaction.channelId;
        if (!channelIdToUse) {
          const defaultChannel = await channelRateService.getDefaultChannel(transaction.pgId, 'PAYIN');
          channelIdToUse = defaultChannel.id;
          effectiveChannelId = defaultChannel.id;
        }
        // Use schema rate only for deduction so charge matches displayed rate (e.g. 2.8%), not user override (e.g. 1.5%)
        initiatorRateUsed = await channelRateService.getSchemaPayinRateOnly(transaction.initiatorId, channelIdToUse);
        const ch = await prisma.transactionChannel.findUnique({
          where: { id: channelIdToUse },
          select: { code: true, name: true, isDefault: true },
        });
        logger.info(
          `PAYIN rate: channel=${ch?.code} (${ch?.name}${ch?.isDefault ? ', Other Payment Methods' : ''}), rate=${(initiatorRateUsed * 100).toFixed(2)}%, amount=₹${transaction.amount}, charge=₹${(Number(transaction.amount) * initiatorRateUsed).toFixed(2)}`
        );
      } catch (e) {
        logger.warn(`Could not get initiator payin rate, using 2%: ${e}`);
        initiatorRateUsed = 0.02;
      }
      initiatorCharge = Number(transaction.amount) * initiatorRateUsed;
      payinCreditAmount = Number(transaction.amount) - initiatorCharge;
      // So commission uses the same channel (e.g. "Other Payment Methods" when no card type was detected)
      if (effectiveChannelId) (transaction as any).channelId = effectiveChannelId;
    }

    // Calculate and distribute commissions (pass initiator rate so commission uses same schema rate we deducted)
    const commissions = await this.calculateCommissions(transaction, transaction.type === 'PAYIN' ? initiatorRateUsed : undefined);

    // Update transaction
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      // Update transaction status and persist actual charge/net for PAYIN
      const updateData: any = {
        status: 'SUCCESS',
        pgResponse: typeof pgResponse === 'string' ? pgResponse : JSON.stringify(pgResponse),
        pgTransactionId: pgResponse?.transactionId,
        platformCommission: Number(commissions.totalCommission),
        completedAt: new Date(),
      };
      if (transaction.type === 'PAYIN') {
        updateData.pgCharges = initiatorCharge;
        updateData.netAmount = payinCreditAmount;
        if (effectiveChannelId) updateData.channelId = effectiveChannelId;
      }
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: updateData,
      });
      
      // Create commission records and credit wallets
      for (const commission of commissions.breakdown) {
        await tx.commissionTransaction.create({
          data: {
            transactionId,
            userId: commission.userId,
            level: commission.level,
            rate: Number(commission.rate),
            amount: Number(commission.amount),
            creditedAt: new Date(),
          },
        });
        
        // Credit wallet (Inline to use same transaction 'tx')
        const commWallet = await tx.wallet.findUnique({
             where: { userId: commission.userId }
        });

        if (commWallet) {
             const commAmount = Number(commission.amount);
             await tx.wallet.update({
                 where: { id: commWallet.id },
                 data: { balance: { increment: commAmount } }
             });

             await tx.walletTransaction.create({
                 data: {
                     walletId: commWallet.id,
                     type: 'COMMISSION',
                     amount: commAmount,
                     balanceBefore: commWallet.balance,
                     balanceAfter: Number(commWallet.balance) + commAmount,
                     description: `Commission from transaction ${transaction.transactionId}`,
                     referenceId: transactionId,
                     referenceType: 'TRANSACTION'
                 }
             });
        }
      }

      // If PAYIN, credit the initiator's wallet with net amount (amount minus schema/channel charge)
      if (transaction.type === 'PAYIN') {
        const initiatorWallet = await tx.wallet.findUnique({
          where: { userId: transaction.initiatorId },
        });

        if (initiatorWallet) {
          await tx.wallet.update({
            where: { id: initiatorWallet.id },
            data: { balance: { increment: payinCreditAmount } },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: initiatorWallet.id,
              type: 'CREDIT',
              amount: payinCreditAmount,
              balanceBefore: initiatorWallet.balance,
              balanceAfter: Number(initiatorWallet.balance) + payinCreditAmount,
              description: `Wallet Load (net after ${(initiatorRateUsed * 100).toFixed(2)}% charge)`,
              referenceId: transactionId,
              referenceType: 'TRANSACTION',
            },
          });
        }
      }
      
      return updated;
    });
    
    return updatedTransaction;
  },

  /**
   * Update transaction with payment method / card type from PG response.
   * Builds rawPaymentMethod for channel detection (e.g. "upi", "netbanking", "credit_visa_normal", "debitcard")
   * and resolves channelId so commission uses per-channel rates.
   */
  async updateTransactionWithCardType(
    transactionId: string,
    cardTypeInfo: {
      internalPG?: string;
      cardNetwork?: string;
      cardCategory?: string;
      paymentMethod?: string;
      cardLast4?: string;
      cardTypeCode?: string;
      pgPaymentId?: string;
      pgOrderId?: string;
    }
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, pgId: true, type: true },
    });
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    const method = (cardTypeInfo.paymentMethod || '').toLowerCase();
    const network = (cardTypeInfo.cardNetwork || '').toLowerCase();
    const category = (cardTypeInfo.cardCategory || 'normal').toLowerCase();

    let rawPaymentMethod: string;
    if (method === 'card' && network) {
      // Include network for both debit and credit so RuPay/Visa/etc. get the correct channel rate
      if (category === 'debit' || method === 'debit') {
        rawPaymentMethod = `debit_${network}_${category}`.replace(/\s+/g, '_');
      } else {
        rawPaymentMethod = `credit_${network}_${category}`.replace(/\s+/g, '_');
      }
    } else if (method) {
      rawPaymentMethod = method; // upi, netbanking, wallet, etc.
    } else if (cardTypeInfo.cardTypeCode) {
      rawPaymentMethod = cardTypeInfo.cardTypeCode;
    } else {
      rawPaymentMethod = network || 'unknown';
    }

    let channelId: string | null = null;
    if (transaction.type === 'PAYIN') {
      try {
        const channel = await channelRateService.detectChannel(
          transaction.pgId,
          rawPaymentMethod,
          'PAYIN'
        );
        channelId = channel.id;
        logger.info(`Channel detected for ${rawPaymentMethod}: ${channel.code} (${channel.name})`);
      } catch (e) {
        logger.warn(`Channel detection failed for rawPaymentMethod=${rawPaymentMethod}: ${e}`);
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        rawPaymentMethod,
        channelId,
      },
    });
    return updated;
  },
  
    /**
     * Calculate hierarchical commissions
     *
     * Commission rule: each level gets (child's rate - my rate).
     * - Initiator (e.g. Distributor) is charged their schema rate (e.g. 3%); that amount is deducted, rest credited.
     * - For non-Admin levels: "my rate" = their schema rate (e.g. MD 2.5%). Commission = child rate - my rate (e.g. MD gets 3% - 2.5% = 0.5%).
     * - For Admin/SuperAdmin: "my rate" = PG base rate (channel baseCost). Commission = child rate - base (e.g. Admin gets 2.5% - 2% = 0.5%).
     * PG base is a floor for Admin only; for all lower hierarchy the schema rate is followed.
     */
    async calculateCommissions(transaction: any, initiatorPayinRateUsed?: number) {
    const breakdown: Array<{
      userId: string;
      level: number;
      rate: number;
      amount: number;
    }> = [];
    
    const pgId = transaction.pgId;
    const amount = Number(transaction.amount);
    const type = transaction.type as 'PAYIN' | 'PAYOUT';
    const channelId = transaction.channelId || undefined;
    
    // PG base (channel baseCost) = Admin's "rate" for commission. Used only for Admin/SuperAdmin; lower hierarchy use schema rate.
    let channelBaseRate = 0.02;
    if (type === 'PAYIN' && channelId) {
      const ch = await prisma.transactionChannel.findUnique({
        where: { id: channelId },
        select: { baseCost: true },
      });
      channelBaseRate = ch ? Number(ch.baseCost ?? 0.02) : 0.02;
    }
    
    // Walk up the hierarchy from initiator
    let currentUserId = transaction.initiatorId;
    let level = 0;
    let childRate: number | null = null; // Rate charged to the child (previous user in chain)
    let lastUser: { id: string; role: string; email: string } | null = null;

    while (currentUserId) {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: { parent: true },
      });

      if (!user) break;

      lastUser = { id: user.id, role: user.role, email: user.email };

      // This user's rate: Admin/SuperAdmin = PG base (floor); initiator when we have actual deducted rate = use it; others = schema rate for this channel
      let userRate: number;

      if (level === 0 && type === 'PAYIN' && initiatorPayinRateUsed != null) {
        userRate = initiatorPayinRateUsed; // Use the schema rate we actually deducted
      } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        userRate = channelBaseRate ?? 0.02;
      } else if (type === 'PAYIN' && channelId) {
        try {
          userRate = await channelRateService.getSchemaPayinRateOnly(currentUserId, channelId);
        } catch (e) {
          userRate = await rateService.getUserRate(currentUserId, pgId, type);
        }
      } else {
        userRate = await rateService.getUserRate(currentUserId, pgId, type, channelId);
      }

      // Commission = what we charged the child minus what this user pays
      if (childRate !== null && childRate > userRate) {
        const commissionRate = childRate - userRate;
        const commissionAmount = amount * commissionRate;

        breakdown.push({
          userId: user.id,
          level,
          rate: commissionRate,
          amount: commissionAmount,
        });

        logger.info(`Commission: ${user.role} (${user.email}) gets ${(commissionRate * 100).toFixed(2)}% = ₹${commissionAmount.toFixed(2)}`);
      }

      childRate = userRate;
      currentUserId = user.parentId || '';
      level++;

      if (level > 10) break;
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') break;
    }

    // If hierarchy ended without reaching ADMIN (e.g. MD has parentId null), assign platform commission to an ADMIN user
    if (currentUserId === '' && lastUser && lastUser.role !== 'ADMIN' && lastUser.role !== 'SUPER_ADMIN' && childRate != null && childRate > channelBaseRate) {
      const adminUser = await prisma.user.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true, email: true, role: true },
      });
      if (adminUser) {
        const commissionRate = childRate - channelBaseRate;
        const commissionAmount = amount * commissionRate;
        breakdown.push({
          userId: adminUser.id,
          level,
          rate: commissionRate,
          amount: commissionAmount,
        });
        logger.info(`Commission (platform): ${adminUser.role} (${adminUser.email}) gets ${(commissionRate * 100).toFixed(2)}% = ₹${commissionAmount.toFixed(2)}`);
      }
    }

    const totalCommission = breakdown.reduce(
      (sum, c) => sum + c.amount,
      0
    );
    
    logger.info(`Total commission: ₹${totalCommission.toFixed(2)} from ${breakdown.length} levels`);
    
    return { 
      breakdown: breakdown.map(b => ({
        ...b,
        rate: new Decimal(b.rate),
        amount: new Decimal(b.amount),
      })), 
      totalCommission: new Decimal(totalCommission) 
    };
  },
  
  async getTransactions(userId: string, params: PaginationParams & {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
    pgId?: string;
    search?: string;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const where: any = {};
    
    // For non-admins, show only their own and their downline's transactions
    if (user.role !== 'ADMIN') {
      const childIds = await userService.getAllChildIds(userId);
      where.initiatorId = { in: [userId, ...childIds] };
    }
    
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.pgId) where.pgId = params.pgId;
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }
    
    if (params.search) {
      where.OR = [
        { transactionId: { contains: params.search, mode: 'insensitive' } },
        { customerName: { contains: params.search, mode: 'insensitive' } },
        { customerEmail: { contains: params.search, mode: 'insensitive' } },
        { cardLast4: { contains: params.search } },
      ];
    }
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          initiator: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
          },
          paymentGateway: {
            select: { id: true, name: true, code: true },
          },
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
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
  
  async getTransactionById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: transactionId },
          { transactionId: transactionId },
        ],
      },
      include: {
        initiator: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        paymentGateway: {
          select: { id: true, name: true, code: true },
        },
        transactionChannel: {
          select: { id: true, code: true, name: true, category: true, cardNetwork: true, cardType: true },
        },
        commissions: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, role: true },
            },
          },
        },
      },
    });
    
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    // Check access
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const hasAccess = await userService.checkAccess(userId, transaction.initiatorId);
      if (!hasAccess && transaction.initiatorId !== userId) {
        throw new AppError('Access denied', 403);
      }
    }
    
    return transaction;
  },
  
  async getTransactionStats(
    userId: string,
    opts: { range?: string; entityId?: string; startDate?: Date; endDate?: Date } = {}
  ) {
    const { range = '7d', entityId, startDate: optStart, endDate: optEnd } = opts;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let startDate = optStart;
    let endDate = optEnd;
    if (!startDate || !endDate) {
      const now = new Date();
      // Include full current day: end at 23:59:59.999 today
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      endDate = endDate || endOfToday;
      switch (range) {
        case '24h':
          startDate = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    const childIds = await userService.getAllChildIds(userId);
    const allowedInitiatorIds = [userId, ...childIds];

    if (entityId) {
      if (entityId !== userId && !childIds.includes(entityId)) {
        throw new AppError('You can only view reports for yourself or your downline', 403);
      }
    }

    // ADMIN without entityId: show all platform transactions; otherwise filter by initiator
    const initiatorFilter = entityId
      ? { initiatorId: entityId }
      : user.role === 'ADMIN'
        ? {}
        : { initiatorId: { in: allowedInitiatorIds } };
    const whereSuccess: any = { status: 'SUCCESS', ...initiatorFilter, createdAt: { gte: startDate, lte: endDate } };
    const whereAll: any = { ...initiatorFilter, createdAt: { gte: startDate, lte: endDate } };

    // Payin-like types: PAYIN and CC_PAYMENT (card/BBPS payments count as payin for reports)
    const payinTypeFilter = { type: { in: ['PAYIN', 'CC_PAYMENT'] as string[] } };

    const [
      payinStats,
      payoutStats,
      totalCountResult,
      commissionWhere,
      todayResults,
      txnsForDaily,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...whereSuccess, ...payinTypeFilter },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...whereSuccess, type: 'PAYOUT' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      prisma.transaction.count({ where: whereAll }),
      entityId
        ? prisma.commissionTransaction.aggregate({
            where: {
              userId,
              transaction: { initiatorId: entityId, createdAt: { gte: startDate, lte: endDate } },
            },
            _sum: { amount: true },
          })
        : prisma.commissionTransaction.aggregate({
            where: { userId, createdAt: { gte: startDate, lte: endDate } },
            _sum: { amount: true },
          }),
      (() => {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const todayWhere = { status: 'SUCCESS', ...initiatorFilter, createdAt: { gte: todayStart, lte: todayEnd } };
        return Promise.all([
          prisma.transaction.aggregate({ where: { ...todayWhere, ...payinTypeFilter }, _count: true, _sum: { amount: true } }),
          prisma.transaction.aggregate({ where: { ...todayWhere, type: 'PAYOUT' }, _count: true, _sum: { amount: true } }),
          entityId
            ? prisma.commissionTransaction.aggregate({
                where: { userId, transaction: { initiatorId: entityId, createdAt: { gte: todayStart, lte: todayEnd } } },
                _sum: { amount: true },
              })
            : prisma.commissionTransaction.aggregate({
                where: { userId, createdAt: { gte: todayStart, lte: todayEnd } },
                _sum: { amount: true },
              }),
        ]);
      })(),
      prisma.transaction.findMany({
        where: whereSuccess,
        select: { type: true, amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalCommissions = commissionWhere._sum.amount || 0;
    const payinCount = payinStats._count || 0;
    const payoutCount = payoutStats._count || 0;
    const successCount = payinCount + payoutCount;
    const totalPayin = Number(payinStats._sum?.amount ?? 0);
    const totalPayout = Number(payoutStats._sum?.amount ?? 0);
    const totalTxns = totalCountResult || 0;
    const successRate = totalTxns > 0 ? Math.round((successCount / totalTxns) * 100) : 0;
    const avgAmount = successCount > 0 ? (totalPayin + totalPayout) / successCount : 0;

    const todayPayinAgg = todayResults?.[0];
    const todayPayoutAgg = todayResults?.[1];
    const todayCommissionAgg = todayResults?.[2];
    const todayPayinCount = todayPayinAgg?._count ?? 0;
    const todayPayoutCount = todayPayoutAgg?._count ?? 0;
    const todayCount = todayPayinCount + todayPayoutCount;
    const todayVolume = Number(todayPayinAgg?._sum?.amount ?? 0) + Number(todayPayoutAgg?._sum?.amount ?? 0);
    const todayCommissionVal = Number(todayCommissionAgg?._sum?.amount ?? 0);

    const byDate: Record<string, { payinAmount: number; payoutAmount: number; payinCount: number; payoutCount: number }> = {};
    for (const tx of txnsForDaily) {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!byDate[key]) byDate[key] = { payinAmount: 0, payoutAmount: 0, payinCount: 0, payoutCount: 0 };
      const isPayinLike = tx.type === 'PAYIN' || tx.type === 'CC_PAYMENT';
      if (isPayinLike) {
        byDate[key].payinAmount += Number(tx.amount ?? 0);
        byDate[key].payinCount += 1;
      } else {
        byDate[key].payoutAmount += Number(tx.amount ?? 0);
        byDate[key].payoutCount += 1;
      }
    }
    const dailyBreakdown = Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      payin: { count: payinCount, totalAmount: totalPayin, netAmount: Number(payinStats._sum?.netAmount ?? 0) },
      payout: { count: payoutCount, totalAmount: totalPayout, netAmount: Number(payoutStats._sum?.netAmount ?? 0) },
      totalCommissions,
      totalPayin,
      totalPayout,
      totalCommission: totalCommissions,
      totalTransactions: successCount,
      payinCount,
      payoutCount,
      successRate,
      avgAmount,
      todayCount,
      todayVolume,
      todayCommission: todayCommissionVal,
      dailyBreakdown,
    };
  },
  
  // Process commissions asynchronously (doesn't block the main transaction)
  async processCommissionsAsync(transaction: any) {
    try {
      let initiatorPayinRate: number | undefined;
      if (transaction.type === 'PAYIN' && transaction.channelId) {
        try {
          initiatorPayinRate = await channelRateService.getSchemaPayinRateOnly(transaction.initiatorId, transaction.channelId);
        } catch {
          // ignore
        }
      }
      const commissions = await this.calculateCommissions(transaction, initiatorPayinRate);
      logger.info(`[Commission] processCommissionsAsync tx=${transaction.transactionId} breakdownCount=${commissions.breakdown.length} totalCommission=${commissions.totalCommission}`);

      if (commissions.breakdown.length === 0) {
        return;
      }

      // Update transaction with commission amount
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          platformCommission: Number(commissions.totalCommission),
        },
      });

      // Create commission records and credit wallets (ledger entries)
      for (const commission of commissions.breakdown) {
        const amountNumber = Number(commission.amount);

        // 1) Store hierarchical commission row
        await prisma.commissionTransaction.create({
          data: {
            transactionId: transaction.id,
            userId: commission.userId,
            level: commission.level,
            rate: Number(commission.rate),
            amount: amountNumber,
            creditedAt: new Date(),
          },
        });

        // 2) Ensure wallet exists and write COMMISSION row to WalletTransaction (Global Ledger)
        try {
          await prisma.$transaction(async (tx) => {
            let wallet = await tx.wallet.findUnique({ where: { userId: commission.userId } });
            if (!wallet) {
              const user = await tx.user.findUnique({ where: { id: commission.userId } });
              if (!user) throw new Error(`User not found: ${commission.userId}`);
              wallet = await tx.wallet.create({ data: { userId: user.id } });
            }
            const balanceBefore = Number(wallet.balance);
            const updated = await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: amountNumber } },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'COMMISSION',
                amount: amountNumber,
                balanceBefore,
                balanceAfter: Number(updated.balance),
                description: `Commission from transaction ${transaction.transactionId}`,
                referenceId: transaction.id,
                referenceType: 'TRANSACTION',
              },
            });
          });
          logger.info(`[Commission] Ledger COMMISSION written userId=${commission.userId} amount=${amountNumber} tx=${transaction.transactionId}`);
        } catch (commissionErr) {
          logger.error(`Failed to credit commission for user ${commission.userId}, tx ${transaction.transactionId}:`, commissionErr);
          throw commissionErr;
        }
      }
    } catch (error) {
      console.error('Error in processCommissionsAsync:', error);
    }
  },
  
  // Manual status update - for when user completes payment on PG page
  // Get transaction by reference (order_id from PG)
  async getTransactionByReference(reference: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { transactionId: reference },
          { pgTransactionId: reference },
        ],
      },
      include: {
        initiator: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        paymentGateway: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    
    return transaction;
  },
  
  async updateTransactionStatus(userId: string, transactionId: string, status: 'SUCCESS' | 'FAILED') {
    // Find the transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: transactionId },
          { transactionId: transactionId },
        ],
      },
      include: {
        initiator: true,
        paymentGateway: true,
      },
    });
    
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    // Check if user has permission to update this transaction
    if (transaction.initiatorId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN') {
        throw new AppError('You can only update your own transactions', 403);
      }
    }
    
    if (transaction.status !== 'PENDING') {
      if (transaction.status === status) {
        return transaction;
      }
      throw new AppError('Transaction already processed', 400);
    }
    
    if (status === 'FAILED') {
      // For PAYOUT, refund the held amount
      if (transaction.type === 'PAYOUT') {
        try {
          const totalDeduction = Number(transaction.amount) + Number(transaction.pgCharges);
          await walletService.releaseHoldOnFailure(
            transaction.initiatorId,
            totalDeduction,
            transaction.id,
            `Payout failed - refund: ${transaction.transactionId}`
          );
        } catch (walletError) {
          console.error('Error refunding hold:', walletError);
        }
      }
      
      const updated = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
        include: {
          paymentGateway: {
            select: { id: true, name: true, code: true },
          },
        },
      });
      return updated;
    }
    
    // For SUCCESS - first update transaction status
    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
      },
      include: {
        paymentGateway: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    
    // Handle wallet operations based on transaction type
    if (transaction.type === 'PAYIN') {
      // Credit the net amount (after PG charges) to the initiator's wallet as CREDIT, not COMMISSION
      try {
        await walletService.creditPayinNet(
          transaction.initiatorId,
          Number(transaction.netAmount),
          transaction.id,
          `Payin credit from ${transaction.transactionId} (after PG charges)`
        );
      } catch (walletError) {
        console.error('Error crediting wallet:', walletError);
      }
    } else if (transaction.type === 'PAYOUT') {
      // Release the hold on success (amount is permanently deducted)
      try {
        const totalDeduction = Number(transaction.amount) + Number(transaction.pgCharges);
        await walletService.releaseHoldOnSuccess(
          transaction.initiatorId,
          totalDeduction,
          transaction.id,
          `Payout completed: ${transaction.transactionId}`
        );
      } catch (walletError) {
        console.error('Error releasing hold:', walletError);
      }
    }
    
    // Calculate and distribute commissions in background (don't block response)
    this.processCommissionsAsync(transaction).catch(err => {
      console.error('Error processing commissions:', err);
    });
    
    return updated;
  },
};

