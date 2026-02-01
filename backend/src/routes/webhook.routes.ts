import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

/**
 * Webhook routes - No authentication required
 * These are called by payment gateways after transaction completion
 */

// Runpaisa callback
router.post('/runpaisa', webhookController.runpaisaCallback);

// Razorpay callback
router.post('/razorpay', webhookController.razorpayCallback);

// Cashfree callback
router.post('/cashfree', webhookController.cashfreeCallback);

// Generic status check (for manual testing)
router.get('/status/:orderId', webhookController.checkStatus);

export default router;

