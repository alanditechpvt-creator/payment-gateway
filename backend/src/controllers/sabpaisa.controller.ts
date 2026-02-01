import { Request, Response } from 'express';
import { sabPaisaService } from '../services/sabpaisa.service';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';
import { transactionService } from '../services/transaction.service';
import { logger } from '../utils/logger';

export const sabPaisaController = {
  /**
   * Render payment form for redirection
   */
  async renderPaymentForm(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

      // Find transaction by transactionId field (not internal id)
      const transaction = await prisma.transaction.findFirst({
        where: { transactionId: transactionId },
        include: {
            initiator: true
        }
      });

      if (!transaction) {
        return res.status(404).send('Transaction not found');
      }

      // Check if already paid
      if (transaction.status === 'SUCCESS') {
          return res.send('Transaction already successful');
      }

      // Generate SabPaisa data
      const paymentData = sabPaisaService.createPayment({
        clientTxnId: transaction.transactionId,
        amount: Number(transaction.amount),
        payerName: `${transaction.initiator.firstName} ${transaction.initiator.lastName}`,
        payerEmail: transaction.initiator.email,
        payerMobile: transaction.customerPhone || '9999999999', // Fallback if not saved
      });

      // Render HTML form
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting to SabPaisa...</title>
        </head>
        <body onload="document.forms[0].submit()">
          <div style="text-align: center; margin-top: 20%;">
            <h1>Please wait, redirecting to payment gateway...</h1>
            <p>Do not close this window.</p>
          </div>
          <form action="${paymentData.actionUrl}" method="POST">
            <input type="hidden" name="encData" value="${paymentData.encData}" />
            <input type="hidden" name="clientCode" value="${paymentData.clientCode}" />
          </form>
        </body>
        </html>
      `;

      res.send(html);

    } catch (error: any) {
      logger.error('Error rendering SabPaisa form:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  /**
   * Create payment request
   */
  async createPayment(req: Request, res: Response) {
    try {
      const { amount, payerName, payerEmail, payerMobile, clientTxnId } = req.body;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      if (!amount || !payerName || !payerEmail || !payerMobile) {
        throw new AppError('Missing required fields', 400);
      }

      // 1. Generate or use clientTxnId
      const txnId = clientTxnId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // 2. Call SabPaisa service to get encrypted data
      const paymentData = sabPaisaService.createPayment({
        clientTxnId: txnId,
        amount: Number(amount),
        payerName,
        payerEmail,
        payerMobile
      });

      // 3. Return data to frontend
      res.json({
        success: true,
        data: paymentData
      });

    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Handle SabPaisa callback
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { encResponse } = req.body;

      if (!encResponse) {
        // Redirect to failure page or return error
        return res.redirect(`${process.env.FRONTEND_URL}/payment/failure?reason=no_response`);
      }

      // 1. Process callback
      const result = sabPaisaService.processCallback(encResponse);
      logger.info(`SabPaisa Callback Result: ${JSON.stringify(result)}`);

      // 2. Update transaction status in database
      if (result.clientTxnId) {
        try {
            // Find transaction by ID
            const transaction = await prisma.transaction.findUnique({
                where: { transactionId: result.clientTxnId }
            });

            if (transaction) {
                 logger.info(`Transaction found: ${transaction.id}. Processing status update...`);
                 if (result.success) {
                    // Update as success using transactionService to handle commissions and wallet credit
                    await transactionService.processTransaction(
                        transaction.id,
                        {
                            ...result.rawData,
                            sabpaisaTxnId: result.sabpaisaTxnId,
                            bankName: result.bankName,
                            paymentMode: result.paymentMode
                        },
                        true
                    );
                    logger.info(`Transaction ${transaction.id} processed successfully.`);
                } else {
                    // Update as failed
                    await transactionService.processTransaction(
                        transaction.id,
                        {
                            ...result.rawData,
                            failureReason: result.message
                        },
                        false
                    );
                    logger.info(`Transaction ${transaction.id} marked as failed.`);
                }
            } else {
                logger.error(`Transaction not found for clientTxnId: ${result.clientTxnId}`);
            }
        } catch (dbError) {
            console.error('Database update error during SabPaisa callback:', dbError);
        }
      } else {
          logger.error('No clientTxnId found in SabPaisa callback');
      }

      // 3. Redirect user based on status or show success page
      // For payment links accessed from other devices, show a simple HTML page
      if (result.success) {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
              .container { text-align: center; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; }
              .success-icon { font-size: 80px; color: #10b981; margin-bottom: 20px; }
              h1 { color: #10b981; margin-bottom: 10px; }
              p { color: #666; margin: 10px 0; }
              .txn-id { background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0; font-family: monospace; word-break: break-all; }
              .amount { font-size: 32px; font-weight: bold; color: #1f2937; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Payment Successful!</h1>
              <p>Your payment has been processed successfully.</p>
              <div class="amount">₹${result.amount || 'N/A'}</div>
              <div class="txn-id">
                <strong>Transaction ID:</strong><br>
                ${result.clientTxnId}
              </div>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
                You can close this window now.<br>
                Thank you for your payment!
              </p>
            </div>
          </body>
          </html>
        `;
        res.send(html);
      } else {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Failed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
              .container { text-align: center; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; }
              .error-icon { font-size: 80px; color: #ef4444; margin-bottom: 20px; }
              h1 { color: #ef4444; margin-bottom: 10px; }
              p { color: #666; margin: 10px 0; }
              .txn-id { background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 20px 0; font-family: monospace; word-break: break-all; }
              .reason { background: #fee2e2; color: #991b1b; padding: 15px; border-radius: 10px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Payment Failed</h1>
              <p>Unfortunately, your payment could not be processed.</p>
              <div class="txn-id">
                <strong>Transaction ID:</strong><br>
                ${result.clientTxnId}
              </div>
              <div class="reason">
                <strong>Reason:</strong><br>
                ${result.message || 'Payment failed'}
              </div>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
                Please contact support if you need assistance.<br>
                You can close this window now.
              </p>
            </div>
          </body>
          </html>
        `;
        res.send(html);
      }

    } catch (error: any) {
      console.error('SabPaisa callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/payment/failure?reason=processing_error`);
    }
  },
  
  /**
   * Get config status
   */
  async getConfigStatus(req: Request, res: Response) {
      const config = sabPaisaService['cfg']; // Access private config
      res.json({
          enabled: config.enabled,
          isProduction: config.isProduction,
          clientCode: config.clientCode ? 'Configured' : 'Missing',
          configured: !!(config.clientCode && config.username && config.password && config.authKey && config.authIV)
      });
  }
};
