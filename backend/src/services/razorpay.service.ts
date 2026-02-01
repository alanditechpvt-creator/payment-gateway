/**
 * Razorpay Payment Gateway Integration
 * 
 * Supports:
 * - Payment creation
 * - Payment verification
 * - Webhook handling
 * - Refunds
 */

import Razorpay from 'razorpay';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import prisma from '../lib/prisma';

interface CreatePaymentParams {
  orderId: string;
  amount: number; // in paise (1 INR = 100 paise)
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  notes?: Record<string, string>;
  redirectUrl?: string;
}

interface VerifyPaymentParams {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

class RazorpayService {
  private client: Razorpay | null = null;
  private cfg = config.razorpay;

  constructor() {
    if (this.isEnabled()) {
      this.client = new Razorpay({
        key_id: this.cfg.keyId,
        key_secret: this.cfg.keySecret,
      });
      logger.info('Razorpay service initialized');
    }
  }

  isEnabled(): boolean {
    return !!(this.cfg && this.cfg.enabled && this.cfg.keyId && this.cfg.keySecret);
  }

  getConfigStatus() {
    const enabled = this.cfg.enabled;
    const configured = !!(this.cfg.keyId && this.cfg.keySecret);
    return {
      enabled,
      configured,
      environment: 'SANDBOX',
      keyId: this.cfg.keyId ? `${this.cfg.keyId.substring(0, 10)}****` : 'Not Set',
      webhookSecret: this.cfg.webhookSecret ? '****' : 'Not Set',
      message: enabled
        ? configured
          ? 'Razorpay enabled and configured'
          : 'Razorpay enabled but not configured'
        : 'Razorpay disabled',
    };
  }

  /**
   * Create an order in Razorpay
   */
  async createOrder(params: CreatePaymentParams): Promise<{
    success: boolean;
    orderId?: string;
    amount?: number;
    currency?: string;
    paymentLink?: string;
    error?: string;
  }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'Razorpay not enabled or configured' };
    }

    if (!this.client) {
      return { success: false, error: 'Razorpay client not initialized' };
    }

    try {
      logger.info(
        `Razorpay createOrder -> orderId=${params.orderId}, amount=${params.amount}`
      );

      const orderData = {
        amount: Math.round(params.amount), // amount in paise
        currency: 'INR',
        receipt: params.orderId,
        notes: {
          ...params.notes,
          orderId: params.orderId,
          customerEmail: params.customerEmail || 'N/A',
          customerPhone: params.customerPhone || 'N/A',
        },
      };

      const order = await this.client.orders.create(orderData);

      logger.info(`Razorpay order created: ${order.id}`);

      // Generate payment link (optional - for hosted checkout)
      const paymentLinkUrl = `https://checkout.razorpay.com/?key_id=${this.cfg.keyId}&order_id=${order.id}`;

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentLink: paymentLinkUrl,
      };
    } catch (error: any) {
      let errorMsg = 'Unknown error';
      
      if (error instanceof Error) {
        errorMsg = error.message;
        logger.error(`Razorpay createOrder failed: ${error.message}`, {
          name: error.name,
          stack: error.stack?.split('\n')[0]
        });
      } else if (typeof error === 'object' && error !== null) {
        // Handle plain object errors from Razorpay SDK
        errorMsg = error.description || error.error_description || error.message || JSON.stringify(error);
        logger.error(`Razorpay createOrder failed: ${errorMsg}`, error);
      } else {
        errorMsg = String(error);
        logger.error(`Razorpay createOrder failed: ${errorMsg}`);
      }
      
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(params: VerifyPaymentParams): boolean {
    if (!this.cfg.keySecret) {
      logger.error('Key secret not configured');
      return false;
    }

    try {
      const signature = crypto
        .createHmac('sha256', this.cfg.keySecret)
        .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
        .digest('hex');

      const isValid = signature === params.razorpay_signature;

      if (!isValid) {
        logger.warn(
          `Razorpay signature verification failed for payment ${params.razorpay_payment_id}`
        );
      }

      return isValid;
    } catch (error) {
      logger.error(
        `Razorpay signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   */
  async getPaymentDetails(paymentId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isEnabled() || !this.client) {
      return { success: false, error: 'Razorpay not enabled or configured' };
    }

    try {
      const payment = await this.client.payments.fetch(paymentId);
      logger.info(`Razorpay payment details fetched: ${paymentId}`);
      return { success: true, data: payment };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Razorpay getPaymentDetails failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Fetch order details from Razorpay
   */
  async getOrderDetails(orderId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isEnabled() || !this.client) {
      return { success: false, error: 'Razorpay not enabled or configured' };
    }

    try {
      const order = await this.client.orders.fetch(orderId);
      logger.info(`Razorpay order details fetched: ${orderId}`);
      return { success: true, data: order };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Razorpay getOrderDetails failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Process refund
   */
  async createRefund(paymentId: string, amount?: number, notes?: Record<string, string>): Promise<{
    success: boolean;
    refundId?: string;
    data?: any;
    error?: string;
  }> {
    if (!this.isEnabled() || !this.client) {
      return { success: false, error: 'Razorpay not enabled or configured' };
    }

    try {
      const refundData: any = {
        notes: notes || {},
      };

      if (amount) {
        refundData.amount = Math.round(amount); // in paise
      }

      const refund = await this.client.payments.refund(paymentId, refundData);

      logger.info(
        `Razorpay refund created: ${refund.id} for payment ${paymentId}`
      );

      return { success: true, refundId: refund.id, data: refund };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Razorpay createRefund failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Handle webhook signature verification
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.cfg.webhookSecret) {
      logger.error('Webhook secret not configured');
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha256', this.cfg.webhookSecret)
        .update(body)
        .digest('hex');

      const isValid = hash === signature;

      if (!isValid) {
        logger.warn('Razorpay webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      logger.error(
        `Razorpay webhook verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: any): Promise<{
    success: boolean;
    processed?: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      logger.info(`Razorpay webhook event: ${event.event}`);

      switch (event.event) {
        case 'payment.authorized':
          return await this.handlePaymentAuthorized(event.payload);

        case 'payment.failed':
          return await this.handlePaymentFailed(event.payload);

        case 'payment.captured':
          return await this.handlePaymentCaptured(event.payload);

        case 'refund.created':
          return await this.handleRefundCreated(event.payload);

        default:
          logger.info(`Unhandled webhook event: ${event.event}`);
          return { success: true, processed: false };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Razorpay webhook processing error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Handle payment authorized event
   */
  private async handlePaymentAuthorized(payload: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const payment = payload.payment.entity;
      logger.info(`Payment authorized: ${payment.id}`);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          orderId: payment.order_id,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error handling payment authorized: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(payload: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const payment = payload.payment.entity;
      logger.warn(`Payment failed: ${payment.id}, reason: ${payment.failure_reason}`);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          failureReason: payment.failure_reason,
          orderId: payment.order_id,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error handling payment failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Handle payment captured event
   */
  private async handlePaymentCaptured(payload: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const payment = payload.payment.entity;
      logger.info(`Payment captured: ${payment.id}`);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          orderId: payment.order_id,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error handling payment captured: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Handle refund created event
   */
  private async handleRefundCreated(payload: any): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const refund = payload.refund.entity;
      logger.info(`Refund created: ${refund.id}`);

      return {
        success: true,
        data: {
          refundId: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          status: refund.status,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error handling refund created: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}

export const razorpayService = new RazorpayService();
