import { Response, NextFunction, Request } from 'express';
import { razorpayService } from '../services/razorpay.service';
import { transactionService } from '../services/transaction.service';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

export const razorpayController = {
  /**
   * Create a Razorpay order for a transaction
   */
  async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId, amount, description } = req.body;
      const userId = req.user!.userId;

      // Verify transaction exists and belongs to user
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { initiator: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (transaction.initiatorId !== userId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const result = await razorpayService.createOrder({
        orderId: transactionId,
        amount: Math.round(amount * 100), // Convert to paise
        customerId: userId,
        customerName: `${transaction.initiator?.firstName || ''} ${transaction.initiator?.lastName || ''}`.trim(),
        customerEmail: transaction.initiator?.email,
        customerPhone: transaction.initiator?.phone,
        description: description || `Payment for transaction ${transactionId}`,
        notes: {
          transactionId,
          userId,
          type: transaction.type,
        },
      });

      if (!result.success) {
        console.error(`Razorpay createOrder failed for transaction ${transactionId}:`, result.error);
        logger.error(`Razorpay createOrder failed for transaction ${transactionId}: ${result.error}`);
        return res.status(400).json({ success: false, error: result.error });
      }

      // Store Razorpay order ID in transaction
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          pgTransactionId: result.orderId,
          pgResponse: JSON.stringify({ orderId: result.orderId }),
        },
      });

      res.json({
        success: true,
        data: {
          transactionId,
          razorpayOrderId: result.orderId,
          amount: result.amount,
          currency: result.currency,
          keyId: process.env.RAZORPAY_KEY_ID, // For frontend checkout
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify payment signature (called from frontend after payment)
   */
  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      const userId = req.user!.userId;

      logger.info(
        `Razorpay verification -> transactionId=${transactionId}, paymentId=${razorpayPaymentId}`
      );

      // Verify signature
      const isSignatureValid = razorpayService.verifyPaymentSignature({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        razorpay_signature: razorpaySignature,
      });

      if (!isSignatureValid) {
        logger.error(`Invalid signature for payment ${razorpayPaymentId}`);
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed',
        });
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayService.getPaymentDetails(razorpayPaymentId);

      if (!paymentDetails.success) {
        return res.status(400).json({
          success: false,
          error: 'Could not fetch payment details',
        });
      }

      const payment = paymentDetails.data;

      // Update transaction with payment details
      const updatedTransaction = await transactionService.updateTransactionWithCardType(
        transactionId,
        {
          internalPG: 'razorpay',
          cardNetwork: payment.method === 'card' ? (payment.card?.network || 'UNKNOWN') : payment.method,
          cardCategory: payment.card?.type || 'NORMAL',
          cardLast4: payment.card?.last4,
          paymentMethod: payment.method,
          pgPaymentId: razorpayPaymentId,
          pgOrderId: razorpayOrderId,
        }
      );

      // Process transaction success
      const result = await transactionService.processTransaction(
        transactionId,
        {
          ORDERSTATUS: {
            status: payment.status,
            PG_PARTNER: 'razorpay',
            PAYMENT_ID: razorpayPaymentId,
            CARD_TYPE: payment.card?.network,
            TXN_MODE: payment.method,
            CARD_NUMBER: `****${payment.card?.last4 || ''}`,
          },
        },
        payment.status === 'captured'
      );

      res.json({
        success: true,
        data: {
          transactionId,
          paymentId: razorpayPaymentId,
          status: payment.status,
          amount: payment.amount,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Webhook endpoint for Razorpay events
   */
  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      // Get raw body for signature verification
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const signature = req.headers['x-razorpay-signature'] as string;

      if (!signature) {
        logger.warn('Razorpay webhook received without signature');
        return res.status(400).json({ success: false, error: 'Missing signature' });
      }

      // Verify webhook signature
      const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);

      if (!isValid) {
        logger.error('Razorpay webhook signature verification failed');
        return res.status(403).json({ success: false, error: 'Invalid signature' });
      }

      const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      logger.info(`Razorpay webhook event received: ${event.event}`);

      // Process webhook event
      const result = await razorpayService.processWebhookEvent(event);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      // Handle payment-related events
      if (event.event === 'payment.authorized' || event.event === 'payment.captured') {
        const payment = event.payload.payment.entity;
        const transactionId = payment.notes?.transactionId;

        if (transactionId) {
          // Update transaction status
          await transactionService.processTransaction(
            transactionId,
            {
              ORDERSTATUS: {
                status: payment.status,
                PG_PARTNER: 'razorpay',
                PAYMENT_ID: payment.id,
                CARD_TYPE: payment.card?.network,
                TXN_MODE: payment.method,
              },
            },
            payment.status === 'captured'
          );

          logger.info(`Transaction ${transactionId} updated with payment ${payment.id}`);
        }
      } else if (event.event === 'payment.failed') {
        const payment = event.payload.payment.entity;
        const transactionId = payment.notes?.transactionId;

        if (transactionId) {
          // Mark transaction as failed
          await prisma.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'FAILED',
              failureReason: payment.failure_reason,
              pgOrderId: payment.order_id,
              pgResponse: JSON.stringify(payment),
            },
          });

          logger.info(`Transaction ${transactionId} marked as failed`);
        }
      }

      // Always return 200 OK to acknowledge webhook receipt
      res.json({ success: true, processed: true });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Razorpay webhook processing error: ${errorMsg}`);
      // Return 200 even on error to prevent webhook retries
      res.json({ success: true, error: errorMsg });
    }
  },

  /**
   * Get payment status
   */
  async getPaymentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const userId = req.user!.userId;

      // Verify transaction exists and belongs to user
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { user: true },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (transaction.userId !== userId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      // If we have Razorpay payment ID, fetch latest status
      if (transaction.pgOrderId) {
        const paymentDetails = await razorpayService.getPaymentDetails(transaction.pgOrderId);

        if (paymentDetails.success) {
          return res.json({
            success: true,
            data: {
              transactionId,
              status: paymentDetails.data.status,
              amount: paymentDetails.data.amount,
              paymentId: paymentDetails.data.id,
              method: paymentDetails.data.method,
              createdAt: new Date(paymentDetails.data.created_at * 1000),
            },
          });
        }
      }

      res.json({
        success: true,
        data: {
          transactionId,
          status: transaction.status,
          amount: transaction.amount,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Process refund
   */
  async refund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { transactionId, amount } = req.body;
      const userId = req.user!.userId;

      // Verify transaction exists and belongs to user or is admin
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (transaction.userId !== userId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      if (!transaction.pgOrderId) {
        return res.status(400).json({
          success: false,
          error: 'No Razorpay payment found for this transaction',
        });
      }

      // Create refund
      const refundResult = await razorpayService.createRefund(
        transaction.pgOrderId,
        amount ? Math.round(amount * 100) : undefined,
        {
          transactionId,
          refundReason: 'User requested refund',
        }
      );

      if (!refundResult.success) {
        return res.status(400).json({ success: false, error: refundResult.error });
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'REFUNDED',
          pgResponse: JSON.stringify({
            refundId: refundResult.refundId,
            originalPaymentId: transaction.pgOrderId,
          }),
        },
      });

      res.json({
        success: true,
        data: {
          transactionId,
          refundId: refundResult.refundId,
          amount: refundResult.data.amount,
          status: refundResult.data.status,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get Razorpay configuration status (for admin)
   */
  async getConfigStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const status = razorpayService.getConfigStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  },
};
