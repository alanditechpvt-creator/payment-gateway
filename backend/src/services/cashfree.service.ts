
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

interface CreateOrderParams {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl?: string;
  notifyUrl?: string;
}

class CashfreeService {
  private baseUrl: string = '';
  private apiVersion = '2023-08-01';

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.baseUrl = config.cashfree.env === 'PROD'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
      
    logger.info(`Cashfree initialized (${config.cashfree.env} mode)`);
  }

  isEnabled(): boolean {
    return config.cashfree.enabled;
  }

  isConfigured(): boolean {
    return !!(config.cashfree.appId && config.cashfree.secretKey);
  }

  /**
   * Create a Cashfree Order
   * API: POST /orders
   */
  async createOrder(params: CreateOrderParams): Promise<{
    success: boolean;
    orderId: string;
    cfOrderId?: string;
    paymentSessionId?: string;
    error?: string;
  }> {
    if (!config.cashfree.appId || !config.cashfree.secretKey) {
      throw new Error('Cashfree credentials not configured');
    }

    try {
      const orderPayload = {
        order_id: params.orderId,
        order_amount: params.amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: params.customerPhone || params.customerEmail || 'cust_' + Date.now(),
          customer_name: params.customerName || 'Customer',
          customer_email: params.customerEmail || 'customer@example.com',
          customer_phone: params.customerPhone || '9999999999',
        },
        order_meta: {
          return_url: params.returnUrl || `${config.urls.mainApp}/dashboard/transactions?status=SUCCESS&order_id={order_id}`,
          notify_url: params.notifyUrl || config.cashfree.callbackUrl,
          payment_methods: null, // null = all methods enabled
        },
      };

      logger.info('Creating Cashfree order:', { orderId: params.orderId, amount: params.amount });

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': this.apiVersion,
          'x-client-id': config.cashfree.appId,
          'x-client-secret': config.cashfree.secretKey,
        },
        body: JSON.stringify(orderPayload),
      });

      const data: any = await response.json();

      if (!response.ok) {
        logger.error('Cashfree create order error:', data);
        return {
          success: false,
          orderId: params.orderId,
          error: data.message || 'Failed to create order',
        };
      }

      logger.info(`Cashfree order created: ${data.cf_order_id}`);

      return {
        success: true,
        orderId: params.orderId,
        cfOrderId: data.cf_order_id,
        paymentSessionId: data.payment_session_id,
        environment: config.cashfree.env === 'PROD' ? 'production' : 'sandbox',
      };
    } catch (error: any) {
      logger.error('Cashfree create order exception:', error);
      return {
        success: false,
        orderId: params.orderId,
        error: error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Get Order Status
   * API: GET /orders/{order_id}
   */
  async getOrderStatus(orderId: string): Promise<{
    orderId: string;
    orderStatus: string;
    orderAmount: number;
    cfOrderId: string;
    payments?: any[];
  } | null> {
    if (!config.cashfree.appId || !config.cashfree.secretKey) {
      throw new Error('Cashfree credentials not configured');
    }

    try {
      // Get order details
      const orderResponse = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-api-version': this.apiVersion,
          'x-client-id': config.cashfree.appId,
          'x-client-secret': config.cashfree.secretKey,
        },
      });

      const orderData: any = await orderResponse.json();

      if (!orderResponse.ok) {
        logger.error('Cashfree get order error:', orderData);
        return null;
      }

      // Get payments for this order
      const paymentsResponse = await fetch(`${this.baseUrl}/orders/${orderId}/payments`, {
        method: 'GET',
        headers: {
          'x-api-version': this.apiVersion,
          'x-client-id': config.cashfree.appId,
          'x-client-secret': config.cashfree.secretKey,
        },
      });

      let payments: any[] = [];
      if (paymentsResponse.ok) {
        payments = await paymentsResponse.json();
      }

      return {
        orderId: orderData.order_id,
        orderStatus: orderData.order_status,
        orderAmount: orderData.order_amount,
        cfOrderId: orderData.cf_order_id,
        payments: Array.isArray(payments) ? payments : [],
      };
    } catch (error: any) {
      logger.error('Cashfree get order status exception:', error);
      return null;
    }
  }

  /**
   * Verify Webhook Signature
   */
  verifyWebhookSignature(timestamp: string, rawBody: string, signature: string): boolean {
    if (!config.cashfree.secretKey) {
      return false;
    }

    try {
      const signedPayload = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', config.cashfree.secretKey)
        .update(signedPayload)
        .digest('base64');

      return expectedSignature === signature;
    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Map Cashfree Order Status to Application Status
   */
  mapOrderStatus(orderStatus: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    const statusMap: { [key: string]: 'PENDING' | 'SUCCESS' | 'FAILED' } = {
      'ACTIVE': 'PENDING',
      'PAID': 'SUCCESS',
      'EXPIRED': 'FAILED',
      'TERMINATED': 'FAILED',
      'PARTIALLY_PAID': 'PENDING',
    };

    return statusMap[orderStatus?.toUpperCase()] || 'PENDING';
  }

  getConfigStatus() {
    return {
      enabled: config.cashfree.enabled,
      appId: config.cashfree.appId ? '***' + config.cashfree.appId.slice(-4) : null,
      environment: config.cashfree.env,
    };
  }
}

export const cashfreeService = new CashfreeService();
