
import { Response, NextFunction, Request } from 'express';
import { cashfreeService } from '../services/cashfree.service';
import { transactionService } from '../services/transaction.service';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { config } from '../config';

export const cashfreeController = {
  /**
   * Create a Cashfree order for a transaction
   */
  async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, amount, customerName, customerEmail, customerPhone } = req.body;
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

      // Create order in Cashfree
      const result = await cashfreeService.createOrder({
        orderId: transactionId,
        amount: Number(amount),
        customerName: customerName || transaction.initiator?.firstName || 'Customer',
        customerEmail: customerEmail || transaction.initiator?.email || 'customer@example.com',
        customerPhone: customerPhone || transaction.initiator?.phone || '9999999999',
      });

      if (!result.success) {
        logger.error(`Cashfree createOrder failed for transaction ${transactionId}: ${result.error}`);
        return res.status(400).json({ success: false, error: result.error });
      }

      // Store Cashfree order ID in transaction
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          pgTransactionId: result.cfOrderId,
          pgResponse: JSON.stringify({ 
            cfOrderId: result.cfOrderId,
            paymentSessionId: result.paymentSessionId,
            environment: config.cashfree.env 
          }),
        },
      });

      res.json({
        success: true,
        data: {
          transactionId,
          orderId: result.orderId,
          cfOrderId: result.cfOrderId,
          paymentSessionId: result.paymentSessionId,
          environment: config.cashfree.env === 'PROD' ? 'production' : 'sandbox',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify payment (called from frontend after payment)
   */
  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'orderId is required' });
      }

      const orderStatus = await cashfreeService.getOrderStatus(orderId);

      if (!orderStatus) {
        return res.status(404).json({ success: false, error: 'Order not found in Cashfree' });
      }

      const status = cashfreeService.mapOrderStatus(orderStatus.orderStatus);
      
      // Update transaction status
      const transaction = await prisma.transaction.findUnique({
        where: { id: orderId },
      });

      if (transaction && transaction.status !== 'SUCCESS' && status === 'SUCCESS') {
        await transactionService.processTransaction(orderId, orderStatus, true);
      } else if (transaction && status === 'FAILED') {
        await transactionService.processTransaction(orderId, orderStatus, false);
      }

      res.json({
        success: true,
        data: {
          orderId: orderStatus.orderId,
          cfOrderId: orderStatus.cfOrderId,
          status,
          amount: orderStatus.orderAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Webhook Handler
   */
  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const rawBody = JSON.stringify(req.body);

      // Verify signature
      if (!cashfreeService.verifyWebhookSignature(timestamp, rawBody, signature)) {
        logger.warn('Invalid Cashfree webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = req.body;
      const eventType = payload.type;
      const order = payload.data?.order || {};
      
      logger.info(`Cashfree webhook received: ${eventType} for order ${order.order_id}`);

      // Handle different event types
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
        await transactionService.processTransaction(order.order_id, payload, true);
        logger.info(`Payment SUCCESS processed for order: ${order.order_id}`);
      } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
        await transactionService.processTransaction(order.order_id, payload, false);
        logger.info(`Payment FAILED processed for order: ${order.order_id}`);
      }

      // Always respond 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('Cashfree webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },

  /**
   * Check Order Status (manual check)
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;

      const orderStatus = await cashfreeService.getOrderStatus(orderId);

      if (!orderStatus) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      res.json({
        success: true,
        data: orderStatus,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
