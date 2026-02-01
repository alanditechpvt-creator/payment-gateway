import { Router, Request } from 'express';
import { razorpayController } from '../controllers/razorpay.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Webhook endpoint (no authentication required, but signature verified)
// IMPORTANT: This must use raw body parser for signature verification
router.post(
  '/webhook',
  // Create raw body parser middleware for this specific route
  (req: any, res, next) => {
    let rawBody = '';
    req.on('data', (chunk: any) => {
      rawBody += chunk.toString();
    });
    req.on('end', () => {
      req.rawBody = rawBody;
      req.body = JSON.parse(rawBody);
      next();
    });
  },
  razorpayController.webhook
);

// All other routes require authentication
router.use(authenticate);

// Create order
router.post('/orders', razorpayController.createOrder);

// Verify payment
router.post('/verify', razorpayController.verifyPayment);

// Get payment status
router.get('/status/:transactionId', razorpayController.getPaymentStatus);

// Refund
router.post('/refund', razorpayController.refund);

// Config status (admin only)
router.get('/config/status', razorpayController.getConfigStatus);

export default router;
