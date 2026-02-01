import { Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { AuthRequest } from '../middleware/auth';
import { runpaisaService } from '../services/runpaisa.service';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export const transactionController = {
  async createTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const transaction = await transactionService.createTransaction(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  },
  
  async getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        type: req.query.type as any,
        status: req.query.status as any,
        pgId: req.query.pgId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        search: req.query.search as string,
      };
      const result = await transactionService.getTransactions(req.user!.userId, params);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
  
  async getTransactionById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const transaction = await transactionService.getTransactionById(req.user!.userId, transactionId);
      res.json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  },
  
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await transactionService.getTransactionStats(req.user!.userId, startDate, endDate);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },
  
  // Webhook for PG callback
  async processWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const { success, pgResponse } = req.body;
      
      // Parse card type from PG response (Runpaisa format)
      if (pgResponse?.ORDERSTATUS) {
        const orderStatus = pgResponse.ORDERSTATUS;
        
        // Extract card type info from Runpaisa response
        const cardTypeInfo = {
          internalPG: orderStatus.PG_PARTNER?.toLowerCase(),     // cashfree, payu, razorpay
          cardNetwork: orderStatus.CARD_TYPE || orderStatus.TXN_MODE, // VISA, MASTER, UPI
          cardCategory: orderStatus.CARD_CATEGORY || 'NORMAL',  // NORMAL, CORPORATE
          cardLast4: orderStatus.CARD_NUMBER?.slice(-4),
          paymentMethod: orderStatus.TXN_MODE,
        };
        
        // Generate card type code
        cardTypeInfo.cardTypeCode = `${cardTypeInfo.internalPG}_${cardTypeInfo.cardNetwork}-${cardTypeInfo.cardCategory}`.toLowerCase();
        
        console.log(`[Webhook] Card Type detected: ${cardTypeInfo.cardTypeCode}`);
        
        // Update transaction with card type
        try {
          await transactionService.updateTransactionWithCardType(transactionId, cardTypeInfo);
        } catch (cardTypeError) {
          console.error('Error updating card type:', cardTypeError);
        }
      }
      
      const result = await transactionService.processTransaction(transactionId, pgResponse, success);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Manual status update (after PG redirect completion)
  async updateTransactionStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { status } = req.body;
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN';
      
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Only admins can override transaction status.' });
      }
      
      // Only allow marking PENDING transactions
      const transaction = await transactionService.getTransactionById(user.userId, transactionId);
      if (transaction.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: 'Only PENDING transactions can be overridden.' });
      }
      const result = await transactionService.updateTransactionStatus(
        user.userId,
        transactionId,
        status
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
  
  // Check status directly with Payment Gateway (OFFLINE mode - no webhook needed)
  async checkStatusWithPG(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      
      // Find the transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          OR: [
            { id: transactionId },
            { transactionId: transactionId },
          ],
        },
        include: {
          paymentGateway: true,
        },
      });
      
      if (!transaction) {
        return res.status(404).json({ 
          success: false, 
          error: 'Transaction not found' 
        });
      }
      
      // Only check pending transactions
      if (transaction.status !== 'PENDING') {
        return res.json({
          success: true,
          data: {
            transaction,
            pgStatus: transaction.status,
            message: `Transaction already ${transaction.status.toLowerCase()}`,
          },
        });
      }
      
      // Check with the appropriate PG
      const pgCode = transaction.paymentGateway?.code?.toUpperCase();
      let pgStatus: any = null;
      
      if (pgCode === 'RUNPAISA' && runpaisaService.isConfigured()) {
        logger.info(`Checking Runpaisa status for: ${transaction.transactionId}`);
        pgStatus = await runpaisaService.getOrderStatus(transaction.transactionId);
        
        if (pgStatus.success && pgStatus.status) {
          // Extract and store card type from PG response
          if (pgStatus.rawResponse?.ORDERSTATUS) {
            const orderStatus = pgStatus.rawResponse.ORDERSTATUS;
            const cardTypeInfo = {
              internalPG: orderStatus.PG_PARTNER?.toLowerCase(),
              cardNetwork: orderStatus.CARD_TYPE || orderStatus.TXN_MODE,
              cardCategory: orderStatus.CARD_CATEGORY || 'NORMAL',
              cardLast4: orderStatus.CARD_NUMBER?.slice(-4),
              paymentMethod: orderStatus.TXN_MODE,
              cardTypeCode: `${(orderStatus.PG_PARTNER || 'unknown').toLowerCase()}_${(orderStatus.CARD_TYPE || orderStatus.TXN_MODE || 'unknown').toLowerCase()}-${(orderStatus.CARD_CATEGORY || 'normal').toLowerCase()}`,
            };
            
            console.log(`[StatusCheck] Card Type detected: ${cardTypeInfo.cardTypeCode}`);
            
            try {
              await transactionService.updateTransactionWithCardType(transaction.id, cardTypeInfo);
            } catch (cardTypeError) {
              console.error('Error updating card type:', cardTypeError);
            }
          }
          
          // Auto-update transaction based on PG status
          if (pgStatus.status === 'SUCCESS') {
            const updated = await transactionService.updateTransactionStatus(
              req.user!.userId,
              transaction.id,
              'SUCCESS'
            );
            return res.json({
              success: true,
              data: {
                transaction: updated,
                pgStatus: pgStatus.status,
                pgDetails: {
                  txnMode: pgStatus.txnMode,
                  txnDate: pgStatus.txnDate,
                  bankTxnId: pgStatus.bankTxnId,
                  cardType: pgStatus.rawResponse?.ORDERSTATUS?.CARD_TYPE,
                  cardCategory: pgStatus.rawResponse?.ORDERSTATUS?.CARD_CATEGORY,
                  pgPartner: pgStatus.rawResponse?.ORDERSTATUS?.PG_PARTNER,
                },
                message: 'Payment verified as successful! Wallet credited.',
                autoUpdated: true,
              },
            });
          } else if (pgStatus.status === 'FAILED' || pgStatus.status === 'FAILURE') {
            const updated = await transactionService.updateTransactionStatus(
              req.user!.userId,
              transaction.id,
              'FAILED'
            );
            return res.json({
              success: true,
              data: {
                transaction: updated,
                pgStatus: pgStatus.status,
                pgDetails: {
                  errorDesc: pgStatus.errorDesc,
                },
                message: 'Payment failed on gateway.',
                autoUpdated: true,
              },
            });
          } else {
            // Still pending on PG side
            return res.json({
              success: true,
              data: {
                transaction,
                pgStatus: pgStatus.status || 'PENDING',
                message: 'Payment is still pending on gateway. Please complete the payment.',
                autoUpdated: false,
              },
            });
          }
        } else {
          return res.json({
            success: true,
            data: {
              transaction,
              pgStatus: 'UNKNOWN',
              pgError: pgStatus.error,
              message: 'Could not verify status with gateway. You can manually mark the transaction.',
              autoUpdated: false,
            },
          });
        }
      } else {
        // For non-Runpaisa PGs or if Runpaisa is not configured
        return res.json({
          success: true,
          data: {
            transaction,
            pgStatus: 'MANUAL_CHECK_REQUIRED',
            message: pgCode === 'RUNPAISA' 
              ? 'Runpaisa is not configured. Please check manually and update.'
              : `Status check not available for ${pgCode || 'this gateway'}. Please check manually and update.`,
            autoUpdated: false,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  },
  
  // Get rate breakdown for a transaction (including card type specific rates)
  async getRateBreakdown(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pgId } = req.params;
      const { amount, cardTypeCode } = req.query;
      
      if (!amount || isNaN(Number(amount))) {
        return res.status(400).json({ success: false, error: 'Valid amount is required' });
      }
      
      const breakdown = await transactionService.getTransactionRateBreakdown(
        req.user!.userId,
        pgId,
        Number(amount),
        cardTypeCode as string
      );
      
      res.json({ success: true, data: breakdown });
    } catch (error) {
      next(error);
    }
  },

  // Public endpoint for payment links - no auth required
  async getTransactionByIdPublic(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId } = req.params;
      
      // Find transaction by transactionId (not internal id)
      const transaction = await prisma.transaction.findFirst({
        where: { transactionId },
        include: {
          paymentGateway: {
            select: {
              id: true,
              displayName: true,
              code: true,
            }
          },
          initiator: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      });

      if (!transaction) {
        return res.status(404).json({ 
          success: false, 
          message: 'Transaction not found' 
        });
      }

      // Return limited public data
      const publicData = {
        id: transaction.id,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        status: transaction.status,
        type: transaction.type,
        customerName: transaction.customerName,
        customerEmail: transaction.customerEmail,
        customerPhone: transaction.customerPhone,
        paymentUrl: transaction.paymentUrl,
        pgResponse: transaction.pgResponse,
        paymentGateway: transaction.paymentGateway,
        createdAt: transaction.createdAt,
      };

      res.json({ success: true, data: publicData });
    } catch (error) {
      next(error);
    }
  },
};

