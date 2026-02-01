import { Request, Response } from 'express';
import { runpaisaService } from '../services/runpaisa.service';
import { cashfreeService } from '../services/cashfree.service';
import { razorpayService } from '../services/razorpay.service';
import { transactionService } from '../services/transaction.service';
import { logger } from '../utils/logger';

export const webhookController = {
  /**
   * Handle Razorpay payment callback
   */
  async razorpayCallback(req: Request, res: Response) {
    try {
      logger.info('Razorpay webhook received');
      
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as any).rawBody;

      // If rawBody is missing (e.g. middleware issue), we can't verify signature securely.
      // But for development/test if verify fails, we might check if signature is present.
      if (!rawBody) {
        logger.error('Razorpay webhook: rawBody missing for signature verification');
        return res.status(400).json({ success: false, message: 'Internal Server Error: rawBody missing' });
      }

      if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
         logger.error('Razorpay webhook verification failed');
         return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      const result = await razorpayService.processWebhookEvent(req.body);

      if (!result.success || !result.data) {
        if (result.processed === false) {
           return res.status(200).json({ success: true, message: 'Event ignored' });
        }
        return res.status(400).json({ success: false, message: result.error || 'Processing failed' });
      }

      const { orderId, status, paymentId, failureReason } = result.data;

      if (!orderId) {
         logger.warn('Razorpay webhook: Missing orderId in payload');
         return res.status(200).json({ success: true, message: 'No orderId found, ignoring' });
      }

      const transaction = await transactionService.getTransactionByReference(orderId);
      if (!transaction) {
        logger.error(`Razorpay webhook: Transaction not found for order ${orderId}`);
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      logger.info(`Razorpay webhook: Processing transaction ${transaction.id}, status=${status}`);
      
      if (status === 'captured') {
        // Payment successful
        await require('../lib/prisma').default.transaction.update({
            where: { id: transaction.id },
            data: {
              pgResponse: JSON.stringify(req.body),
              // We keep pgTransactionId as orderId for reference, or we could append paymentId
            }
         });

        await transactionService.updateTransactionStatus(
          transaction.initiatorId,
          transaction.id,
          'SUCCESS'
        );
        logger.info(`Transaction ${transaction.id} marked SUCCESS via Razorpay webhook`);
        
      } else if (status === 'failed') {
        // Payment failed
        await require('../lib/prisma').default.transaction.update({
            where: { id: transaction.id },
            data: {
              pgResponse: JSON.stringify(req.body),
              failureReason: failureReason || 'Payment failed'
            }
         });

        await transactionService.updateTransactionStatus(
          transaction.initiatorId,
          transaction.id,
          'FAILED'
        );
        logger.info(`Transaction ${transaction.id} marked FAILED via Razorpay webhook`);
      }

      res.status(200).json({ success: true });

    } catch (error: any) {
      logger.error('Razorpay webhook error:', error.message);
      // Return 200 to prevent retries
      res.status(200).json({ success: false, message: 'Error processing webhook' });
    }
  },

  /**
   * Handle Runpaisa payment callback
   * This is called by Runpaisa after payment completion
   */
  async runpaisaCallback(req: Request, res: Response) {
    try {
      logger.info('Runpaisa webhook received:', JSON.stringify(req.body));
      
      const { order_id, status, txn_id, amount, error_message } = req.body;

      if (!order_id) {
        logger.error('Runpaisa webhook: Missing order_id');
        return res.status(400).json({ 
          success: false, 
          message: 'Missing order_id' 
        });
      }

      // Find transaction by reference (order_id)
      const transaction = await transactionService.getTransactionByReference(order_id);
      
      if (!transaction) {
        logger.error(`Runpaisa webhook: Transaction not found for order ${order_id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Transaction not found' 
        });
      }

      // Verify with Runpaisa API
      const verifyResult = await runpaisaService.getOrderStatus(order_id);
      
      if (!verifyResult.success) {
        logger.error(`Runpaisa webhook: Verification failed for ${order_id}`);
        // Still process based on callback data if verification fails
      }

      // Determine final status
      const finalStatus = verifyResult.success 
        ? verifyResult.status 
        : (status || 'UNKNOWN');

      // Update transaction based on status
      if (finalStatus === 'SUCCESS') {
        await transactionService.updateTransactionStatus(
          transaction.id,
          'SUCCESS',
          {
            pgTransactionId: txn_id || verifyResult.bankTxnId,
            pgResponse: JSON.stringify(verifyResult.rawResponse || req.body),
          }
        );
        logger.info(`Transaction ${transaction.id} marked SUCCESS via webhook`);
      } else if (finalStatus === 'FAILED' || finalStatus === 'FAILURE') {
        await transactionService.updateTransactionStatus(
          transaction.id,
          'FAILED',
          {
            failureReason: error_message || verifyResult.errorDesc || 'Payment failed',
            pgResponse: JSON.stringify(verifyResult.rawResponse || req.body),
          }
        );
        logger.info(`Transaction ${transaction.id} marked FAILED via webhook`);
      } else {
        // PENDING or other status - log but don't update
        logger.info(`Transaction ${transaction.id} status: ${finalStatus} (no action)`);
      }

      // Acknowledge receipt
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed',
        order_id,
        status: finalStatus,
      });
    } catch (error: any) {
      logger.error('Runpaisa webhook error:', error.message);
      // Always return 200 to prevent retries (we log the error internally)
      res.status(200).json({ 
        success: false, 
        message: 'Error processing webhook',
        error: error.message,
      });
    }
  },

  /**
   * Handle Cashfree payment callback
   */
  async cashfreeCallback(req: Request, res: Response) {
    try {
      logger.info('Cashfree webhook received');
      logger.info('Cashfree webhook body:', JSON.stringify(req.body, null, 2));
      logger.info('Cashfree webhook headers:', JSON.stringify(req.headers, null, 2));

      // Verify signature if possible
      const verified = cashfreeService.verifyCallback(req.body, req.headers as any);
      if (!verified) {
        logger.error('Cashfree webhook verification failed');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      // Cashfree sends data in nested structure: { data: { order_id, ... } }
      const payloadData = req.body.data || req.body;
      const { order_id, orderAmount, orderStatus, txStatus, referenceId } = payloadData as any;

      logger.info(`Cashfree webhook parsing: order_id=${order_id}, orderStatus=${orderStatus}, txStatus=${txStatus}`);

      if (!order_id) {
        logger.error('Cashfree webhook: Missing order_id. Payload:', JSON.stringify(payloadData));
        return res.status(400).json({ success: false, message: 'Missing order_id' });
      }

      const transaction = await transactionService.getTransactionByReference(order_id);
      if (!transaction) {
        logger.error(`Cashfree webhook: Transaction not found for order ${order_id}`);
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // Verify with Cashfree API if needed
      const verifyResult = await cashfreeService.getOrderStatus(order_id);

      const finalStatus = verifyResult.success ? verifyResult.status : (orderStatus || txStatus || 'UNKNOWN');

      logger.info(`Cashfree webhook: finalStatus=${finalStatus} for transaction ${transaction.id}`);

      if (finalStatus === 'SUCCESS' || finalStatus === 'PAID') {
        // Persist PG response and reference before updating status
        try {
          const pgResp = JSON.stringify(verifyResult.raw || payloadData);
          await require('../lib/prisma').default.transaction.update({
            where: { id: transaction.id },
            data: {
              pgTransactionId: referenceId || undefined,
              pgResponse: pgResp,
            },
          });
        } catch (e) {
          logger.error('Error saving PG response before status update:', e);
        }

        // Call updateTransactionStatus as the initiator so permission check passes
        await transactionService.updateTransactionStatus(
          transaction.initiatorId,
          transaction.id,
          'SUCCESS'
        );
        logger.info(`Transaction ${transaction.id} marked SUCCESS via Cashfree webhook`);
      } else if (finalStatus === 'FAILED' || finalStatus === 'FAILURE') {
        try {
          const pgResp = JSON.stringify(verifyResult.raw || payloadData);
          await require('../lib/prisma').default.transaction.update({
            where: { id: transaction.id },
            data: {
              pgResponse: pgResp,
            },
          });
        } catch (e) {
          logger.error('Error saving PG response before marking failed:', e);
        }

        await transactionService.updateTransactionStatus(
          transaction.initiatorId,
          transaction.id,
          'FAILED'
        );
        logger.info(`Transaction ${transaction.id} marked FAILED via Cashfree webhook`);
      } else {
        logger.info(`Transaction ${transaction.id} status: ${finalStatus} (no action)`);
      }

      res.status(200).json({ success: true, message: 'Webhook processed', order_id, status: finalStatus });
    } catch (error: any) {
      logger.error('Cashfree webhook error:', error.message);
      logger.error('Cashfree webhook error stack:', error.stack);
      res.status(200).json({ success: false, message: 'Error processing webhook', error: error.message });
    }
  },

  /**
   * Manual status check endpoint
   * Can be used to verify transaction status with PG
   */
  async checkStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Order ID required' 
        });
      }

      // 1. Find transaction
      const transaction = await transactionService.getTransactionByReference(orderId);
      if (!transaction) {
         return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      // 2. Identify PG
      const pg = await require('../lib/prisma').default.paymentGateway.findUnique({
        where: { id: transaction.pgId }
      });
      
      if (!pg) {
        return res.status(400).json({ success: false, message: 'PG not found' });
      }

      let result: { success: boolean; status?: string; raw?: any } = { success: false };

      // 3. Check status based on PG
      if (pg.code === 'RAZORPAY') {
        // Razorpay verify logic (fetch order/payment)
        try {
             const rpResult = await razorpayService.getOrderDetails(orderId);
             if (rpResult.success && rpResult.data) {
                const rpOrder = rpResult.data;
                result = {
                    success: true,
                    status: rpOrder.status === 'paid' ? 'SUCCESS' : (rpOrder.status === 'attempted' ? 'PENDING' : rpOrder.status),
                    raw: rpOrder
                };
             }
        } catch (e) {
            logger.error('Razorpay check status failed', e);
        }

      } else if (pg.code === 'CASHFREE') {
         const cfResult = await cashfreeService.getOrderStatus(orderId);
         result = {
            success: cfResult.success,
            status: cfResult.status,
            raw: cfResult.raw
         };
      } else if (pg.code === 'RUNPAISA') {
         result = await runpaisaService.getOrderStatus(orderId);
      } else {
         return res.status(400).json({ success: false, message: `Status check not implemented for ${pg.code}` });
      }

      // 4. Update Transaction if changed
      if (result.success && result.status) {
         if ((result.status === 'SUCCESS' || result.status === 'PAID') && transaction.status !== 'SUCCESS') {
             await transactionService.updateTransactionStatus(
                transaction.initiatorId,
                transaction.id,
                'SUCCESS'
             );
         } else if ((result.status === 'FAILED' || result.status === 'FAILURE') && transaction.status !== 'FAILED') {
             await transactionService.updateTransactionStatus(
                transaction.initiatorId,
                transaction.id,
                'FAILED'
             );
         }
      }

      res.json({
        success: true,
        status: result.status || transaction.status,
        data: result,
      });
    } catch (error: any) {
      logger.error('Check status error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  },
};

