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
import { cardTypeService } from './cardType.service';
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
            pgRates: {
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
      const payinRate = userRate || Number(pg.baseRate);
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
      
      const slabs = slabsJson ? JSON.parse(slabsJson) : [];
      
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
        // Default to highest slab or a fallback charge if no slab matches
        // This handles amounts higher than the highest defined maxAmount (if any slab has maxAmount)
        // Ideally the last slab should have maxAmount = null
        const highestSlab = slabs.sort((a: any, b: any) => b.minAmount - a.minAmount)[0];
        pgCharges = highestSlab ? new Decimal(highestSlab.flatCharge) : new Decimal(25); // Default ₹25
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
    
    const schemaPGRate = await prisma.schemaPGRate.findUnique({
      where: {
        schemaId_pgId: { schemaId, pgId },
      },
      include: {
        payoutSlabs: {
          orderBy: { minAmount: 'asc' },
        },
      },
    });
    
    if (!schemaPGRate || schemaPGRate.payoutSlabs.length === 0) {
      return this.getDefaultPayoutSlabs();
    }
    
    return schemaPGRate.payoutSlabs;
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
      include: {
        initiator: {
          include: {
            schema: {
              include: {
                pgRates: true,
              },
            },
          },
        },
      },
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
    
    // Calculate and distribute commissions
    // First, try to determine card type from response if available
    if (pgResponse && (pgResponse.cardTypeCode || pgResponse.cardNetwork || pgResponse.cardCategory)) {
      try {
        const cardType = await cardTypeService.findOrCreateCardTypeFromResponse(
          transaction.pgId,
          pgResponse
        );
        if (cardType) {
          transaction.cardTypeId = cardType.id;
          (transaction as any).cardType = cardType;
        }
      } catch (error) {
        logger.warn(`Failed to resolve card type from response: ${error}`);
      }
    }

    const commissions = await this.calculateCommissions(transaction);
    
    // Update transaction
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      // Update transaction status
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'SUCCESS',
          pgResponse: typeof pgResponse === 'string' ? pgResponse : JSON.stringify(pgResponse),
          pgTransactionId: pgResponse?.transactionId,
          platformCommission: Number(commissions.totalCommission),
          completedAt: new Date(),
          cardTypeId: transaction.cardTypeId, // Save the resolved card type
        },
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

      // If PAYIN, credit the initiator's wallet with the principal amount (minus any deductions if applicable)
      // Assuming PAYIN adds money to wallet.
      if (transaction.type === 'PAYIN') {
        // Find initiator wallet
        const initiatorWallet = await tx.wallet.findUnique({
            where: { userId: transaction.initiatorId }
        });

        if (initiatorWallet) {
             const creditAmount = Number(transaction.amount); // Or netAmount if charges apply? usually payin is full amount credited, charges are borne by platform or user differently. 
             // Let's assume full amount for now as per standard wallet load.
             
             await tx.wallet.update({
                 where: { id: initiatorWallet.id },
                 data: { balance: { increment: creditAmount } }
             });

             await tx.walletTransaction.create({
                 data: {
                     walletId: initiatorWallet.id,
                     type: 'CREDIT',
                     amount: creditAmount,
                     balanceBefore: initiatorWallet.balance,
                     balanceAfter: Number(initiatorWallet.balance) + creditAmount,
                     description: `Wallet Load via ${transaction.pgId}`,
                     referenceId: transactionId,
                     referenceType: 'TRANSACTION'
                 }
             });
        }
      }
      
      return updated;
    });
    
    return updatedTransaction;
  },
  
  /**
   * Calculate hierarchical commissions
   * 
   * Example: If Retailer (rate 1.8%) does ₹10,000 transaction:
   * - PG base rate: 0.8% → PG takes ₹80
   * - Admin (0.8% → 1% to WL) → Admin gets 0.2% = ₹20
   * - WL (1% → 1.5% to MD) → WL gets 0.5% = ₹50
   * - MD (1.5% → 1.8% to Retailer) → MD gets 0.3% = ₹30
   * Total commissions: ₹100 (= 1.8% - 0.8% of ₹10,000)
   */
  async calculateCommissions(transaction: any) {
    const breakdown: Array<{
      userId: string;
      level: number;
      rate: number;
      amount: number;
    }> = [];
    
    const pgId = transaction.pgId;
    const amount = Number(transaction.amount);
    const type = transaction.type as 'PAYIN' | 'PAYOUT';
    const cardTypeId = transaction.cardTypeId;
    
    // Get PG base rate (or Card Type base rate if applicable)
    let pgBaseRate = 0.02; // Default fallback
    
    if (cardTypeId) {
      // If card type is known, use its base rate
      let cardType = (transaction as any).cardType;
      if (!cardType) {
        cardType = await prisma.cardType.findUnique({ where: { id: cardTypeId } });
      }
      
      if (cardType) {
        pgBaseRate = cardType.baseRate;
      } else {
        // Fallback to PG
        const pg = await prisma.paymentGateway.findUnique({ where: { id: pgId } });
        if (pg) pgBaseRate = pg.baseRate;
      }
    } else {
      // Standard PG base rate
      const pg = await prisma.paymentGateway.findUnique({ where: { id: pgId } });
      if (!pg) {
        return { breakdown, totalCommission: new Decimal(0) };
      }
      pgBaseRate = Number(pg.baseRate);
    }
    
    // Walk up the hierarchy from initiator
    let currentUserId = transaction.initiatorId;
    let level = 0;
    let childRate: number | null = null; // Rate charged to the child (previous user in chain)
    
    while (currentUserId) {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: { parent: true },
      });
      
      if (!user) break;
      
      // Get this user's rate (what they pay)
      let userRate: number;
      
      if (user.role === 'ADMIN') {
        // Admin's cost is the PG/CardType base rate
        userRate = pgBaseRate;
      } else {
        // Get rate from UserPGRate or UserCardTypeRate
        if (cardTypeId && type === 'PAYIN') {
          userRate = await cardTypeService.getUserCardTypeRate(currentUserId, cardTypeId);
        } else {
          userRate = await rateService.getUserRate(currentUserId, pgId, type);
        }
      }
      
      // Calculate commission only if we know what we charged the child
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
      
      // For next iteration: this user's rate becomes the child's rate for their parent
      childRate = userRate;
      currentUserId = user.parentId || '';
      level++;
      
      // Prevent infinite loops
      if (level > 10) break;
      
      // Stop at Admin level (they have no parent)
      if (user.role === 'ADMIN') break;
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
  
  async getTransactionStats(userId: string, startDate?: Date, endDate?: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const where: any = { status: 'SUCCESS' };
    
    if (user.role !== 'ADMIN') {
      const childIds = await userService.getAllChildIds(userId);
      where.initiatorId = { in: [userId, ...childIds] };
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    
    const [payinStats, payoutStats, totalCommissions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, type: 'PAYIN' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'PAYOUT' },
        _sum: { amount: true, netAmount: true },
        _count: true,
      }),
      prisma.commissionTransaction.aggregate({
        where: user.role !== 'ADMIN' ? { userId } : {},
        _sum: { amount: true },
      }),
    ]);
    
    return {
      payin: {
        count: payinStats._count,
        totalAmount: payinStats._sum.amount || 0,
        netAmount: payinStats._sum.netAmount || 0,
      },
      payout: {
        count: payoutStats._count,
        totalAmount: payoutStats._sum.amount || 0,
        netAmount: payoutStats._sum.netAmount || 0,
      },
      totalCommissions: totalCommissions._sum.amount || 0,
    };
  },
  
  // Process commissions asynchronously (doesn't block the main transaction)
  async processCommissionsAsync(transaction: any) {
    try {
      const commissions = await this.calculateCommissions(transaction);
      
      // Update transaction with commission amount
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          platformCommission: Number(commissions.totalCommission),
        },
      });
      
      // Create commission records and credit wallets
      for (const commission of commissions.breakdown) {
        await prisma.commissionTransaction.create({
          data: {
            transactionId: transaction.id,
            userId: commission.userId,
            level: commission.level,
            rate: Number(commission.rate),
            amount: Number(commission.amount),
            creditedAt: new Date(),
          },
        });
        
        // Credit wallet
        await walletService.creditCommission(
          commission.userId,
          Number(commission.amount),
          transaction.id,
          `Commission from transaction ${transaction.transactionId}`
        );
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
        initiator: {
          include: {
            schema: {
              include: {
                pgRates: true,
              },
            },
          },
        },
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
      // Credit the net amount to the initiator's wallet
      try {
        await walletService.creditCommission(
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
  
  /**
   * Update transaction with card type information from PG response
   * Call this when processing webhook or status check response
   */
  async updateTransactionWithCardType(
    transactionId: string,
    pgResponse: {
      cardTypeCode?: string;
      internalPG?: string;
      cardNetwork?: string;
      cardCategory?: string;
      cardLast4?: string;
      paymentMethod?: string;
    }
  ) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: transactionId },
          { transactionId: transactionId },
        ],
      },
    });
    
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    // Find or create card type
    const cardType = await cardTypeService.findOrCreateCardTypeFromResponse(
      transaction.pgId,
      pgResponse
    );
    
    // Update transaction with card type
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        cardTypeId: cardType.id,
        cardTypeCode: cardType.code,
        cardLast4: pgResponse.cardLast4,
        cardNetwork: pgResponse.cardNetwork,
        paymentMethod: pgResponse.paymentMethod,
      },
    });
    
    return cardType;
  },
  
  /**
   * Recalculate charges for a transaction based on card type
   * Call this when card type is determined after initial transaction creation
   */
  async recalculateChargesWithCardType(transactionId: string, cardTypeCode: string) {
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
    
    // Only recalculate for pending PAYIN transactions
    if (transaction.status !== 'PENDING' || transaction.type !== 'PAYIN') {
      return null;
    }
    
    // Get card type rate
    const rateResult = await cardTypeService.getTransactionRate(
      transaction.initiatorId,
      transaction.pgId,
      cardTypeCode
    );
    
    // Calculate new charges
    const amount = new Decimal(transaction.amount);
    const newCharges = amount.mul(rateResult.rate);
    const newNetAmount = amount.sub(newCharges);
    
    // Update transaction
    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        cardTypeId: rateResult.cardTypeId,
        pgCharges: Number(newCharges),
        netAmount: Number(newNetAmount),
        pgResponse: JSON.stringify({
          ...JSON.parse(transaction.pgResponse || '{}'),
          rateSource: rateResult.source,
          originalCharges: transaction.pgCharges,
          recalculatedAt: new Date().toISOString(),
        }),
      },
    });
    
    console.log(`[Transaction] Recalculated charges for ${transactionId}: ${rateResult.rate * 100}% (${rateResult.source})`);
    
    return updated;
  },
  
  /**
   * Get transaction rate breakdown for display
   */
  async getTransactionRateBreakdown(
    userId: string,
    pgId: string,
    amount: number,
    cardTypeCode?: string
  ) {
    const rateResult = await cardTypeService.getTransactionRate(userId, pgId, cardTypeCode);
    
    const charges = amount * rateResult.rate;
    const netAmount = amount - charges;
    
    // Get card type details if available
    let cardTypeDetails = null;
    if (rateResult.cardTypeId) {
      cardTypeDetails = await prisma.cardType.findUnique({
        where: { id: rateResult.cardTypeId },
        select: {
          id: true,
          code: true,
          name: true,
          internalPG: true,
          cardNetwork: true,
          cardCategory: true,
          baseRate: true,
        },
      });
    }
    
    return {
      amount,
      rate: rateResult.rate,
      ratePercent: `${(rateResult.rate * 100).toFixed(2)}%`,
      source: rateResult.source,
      charges,
      netAmount,
      cardType: cardTypeDetails,
    };
  },
};

