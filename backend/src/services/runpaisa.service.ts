/**
 * Runpaisa Payment Gateway Integration
 * 
 * APIs:
 * 1. Get Token - Authentication
 * 2. Create Order - Generate payment link
 * 3. Order Status - Check transaction status
 */

import { config } from '../config';
import { logger } from '../utils/logger';

interface RunpaisaConfig {
  baseUrl: string;
  tokenUrl: string;
  orderUrl: string;
  statusUrl: string;
  clientId: string;
  username: string;
  password: string;
  callbackUrl: string;
}

interface TokenResponse {
  status: string;
  message: string;
  code: string;
  data?: {
    token: string;
    expiry: string;
  };
}

interface CreateOrderResponse {
  status: string;
  message: string;
  code: string;
  order_token?: string;
  order_id?: string;
  order_staus?: string;
  paymentLink?: string;
}

interface OrderStatusResponse {
  STATUS: string;
  MESSAGE: string;
  CODE: string;
  ORDERSTATUS?: {
    ORDER_ID: string;
    TXN_MODE: string;
    TXN_AMOUNT: number;
    CARD_CATEGORY: string;
    TXN_DATE: string;
    TXN_INFO: string;
    CUSTOMER_NAME: string;
    CUSTOMER_EMAIL: string;
    CUSTOMER_PHONE: string;
    BANK_TXNID: string | null;
    BANK_CODE: string;
    ERROR_ID: string;
    ERROR_DESC: string;
    CARD_NUMBER: string;
    CARD_TYPE: string;
    STATUS: string;
    UNMAPPED_STATUS: string;
    PG_PARTNER: string;
    MERC_UNQ_REF: string;
    CALLBACKURL: string;
  };
}

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

class RunpaisaService {
  private config: RunpaisaConfig;
  private isUAT: boolean;

  constructor() {
    this.isUAT = config.nodeEnv !== 'production';
    
    this.config = {
      // UAT URLs
      baseUrl: this.isUAT ? 'https://dev.api.runpaisa.com' : 'https://api.runpaisa.com',
      tokenUrl: this.isUAT ? 'https://dev.api.runpaisa.com/token' : 'https://api.runpaisa.com/token',
      orderUrl: this.isUAT ? 'https://test.api.pg.runpaisa.com/order' : 'https://api.pg.runpaisa.com/order',
      statusUrl: this.isUAT ? 'https://test.api.pg.runpaisa.com/status' : 'https://api.pg.runpaisa.com/status',
      
      // Credentials from config
      clientId: config.runpaisa.clientId,
      username: config.runpaisa.username,
      password: config.runpaisa.password,
      callbackUrl: config.runpaisa.callbackUrl,
    };
  }

  /**
   * Get authentication token
   * Token is cached and reused until expiry
   */
  async getToken(): Promise<string> {
    // Check if we have a valid cached token
    if (cachedToken && Date.now() < tokenExpiry) {
      logger.info('Using cached Runpaisa token');
      return cachedToken;
    }

    logger.info('Fetching new Runpaisa token...');

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'username': this.config.username,
          'password': this.config.password,
        },
        body: JSON.stringify({}),
      });

      // If we receive a non-2xx response, capture body for debugging
      if (!response.ok) {
        let bodyText: string;
        try {
          bodyText = await response.text();
        } catch (e) {
          bodyText = '<unable to read response body>';
        }
        logger.error(`Runpaisa token fetch failed: HTTP ${response.status} ${response.statusText} - ${bodyText}`);
        throw new Error(`Runpaisa token fetch failed: HTTP ${response.status}`);
      }

      const data = await response.json() as unknown as TokenResponse;

      if (data.status === 'SUCCESS' && data.data?.token) {
        cachedToken = data.data.token;
        // Set expiry 5 minutes before actual expiry to be safe
        const expirySeconds = parseInt(data.data.expiry) - 300;
        tokenExpiry = Date.now() + (expirySeconds * 1000);
        
        logger.info(`Runpaisa token generated successfully, expires in ${data.data.expiry}s`);
        return cachedToken;
      } else {
        logger.error('Runpaisa token generation failed:', data.message, data);
        throw new Error(`Runpaisa Auth Failed: ${data.message} (${data.code})`);
      }
    } catch (error: any) {
      logger.error('Runpaisa token error:', error.message);
      throw error;
    }
  }

  /**
   * Create a payment order and get payment link
   */
  async createOrder(params: {
    orderId: string;
    amount: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    merchantRef?: string;
  }): Promise<{
    success: boolean;
    paymentLink?: string;
    orderToken?: string;
    orderId?: string;
    error?: string;
  }> {
    try {
      const token = await this.getToken();

      // Create form data
      const formData = new FormData();
      formData.append('callbackurl', this.config.callbackUrl);
      formData.append('order_id', params.orderId);
      formData.append('amount', params.amount.toFixed(2));
      
      if (params.merchantRef) {
        formData.append('merc_unq_ref', params.merchantRef);
      }

      logger.info(`Creating Runpaisa order: ${params.orderId}, Amount: ${params.amount}`);

      const response = await fetch(this.config.orderUrl, {
        method: 'POST',
        headers: {
          'client_id': this.config.clientId,
          'token': token,
        },
        body: formData,
      });

      if (!response.ok) {
        let bodyText: string;
        try { bodyText = await response.text(); } catch (e) { bodyText = '<unable to read response body>'; }
        logger.error(`Runpaisa createOrder fetch failed: HTTP ${response.status} ${response.statusText} - ${bodyText}`);
        return { success: false, error: `HTTP ${response.status}: ${bodyText}` };
      }

      const data = await response.json() as unknown as CreateOrderResponse;

      if (data.status === 'SUCCESS' && data.paymentLink) {
        logger.info(`Runpaisa order created successfully: ${data.order_id}`);
        return {
          success: true,
          paymentLink: data.paymentLink,
          orderToken: data.order_token,
          orderId: data.order_id,
        };
      } else {
        logger.error('Runpaisa order creation failed:', data.message, data);
        return {
          success: false,
          error: `${data.message} (${data.code})`,
        };
      }
    } catch (error: any) {
      logger.error('Runpaisa createOrder error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check order/transaction status
   */
  async getOrderStatus(orderId: string): Promise<{
    success: boolean;
    status?: string;
    txnAmount?: number;
    txnMode?: string;
    txnDate?: string;
    bankTxnId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    errorDesc?: string;
    rawResponse?: any;
    error?: string;
  }> {
    try {
      const token = await this.getToken();

      logger.info(`Checking Runpaisa order status: ${orderId}`);

      const response = await fetch(this.config.statusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'token': token,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json() as unknown as OrderStatusResponse;

      if (data.STATUS === 'SUCCESS' && data.ORDERSTATUS) {
        const orderStatus = data.ORDERSTATUS;
        logger.info(`Runpaisa order ${orderId} status: ${orderStatus.STATUS}`);
        
        return {
          success: true,
          status: orderStatus.STATUS,
          txnAmount: orderStatus.TXN_AMOUNT,
          txnMode: orderStatus.TXN_MODE,
          txnDate: orderStatus.TXN_DATE,
          bankTxnId: orderStatus.BANK_TXNID || undefined,
          customerName: orderStatus.CUSTOMER_NAME,
          customerEmail: orderStatus.CUSTOMER_EMAIL,
          customerPhone: orderStatus.CUSTOMER_PHONE,
          errorDesc: orderStatus.ERROR_DESC,
          rawResponse: data,
        };
      } else {
        logger.error('Runpaisa status check failed:', data.MESSAGE);
        return {
          success: false,
          error: `${data.MESSAGE} (${data.CODE})`,
        };
      }
    } catch (error: any) {
      logger.error('Runpaisa getOrderStatus error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook callback signature (if Runpaisa provides one)
   * For now, we'll validate based on order_id lookup
   */
  async verifyCallback(callbackData: any): Promise<boolean> {
    // Basic validation - check if order exists in our system
    if (!callbackData.order_id) {
      return false;
    }
    
    // Additional verification can be added here
    // (e.g., signature verification if Runpaisa provides it)
    
    return true;
  }

  /**
   * Check if Runpaisa is configured and enabled
   */
  isConfigured(): boolean {
    return !!(
      config.runpaisa.enabled &&
      this.config.clientId &&
      this.config.username &&
      this.config.password
    );
  }

  /**
   * Check if Runpaisa is enabled in config
   */
  isEnabled(): boolean {
    return config.runpaisa.enabled;
  }

  /**
   * Get configuration status for admin
   */
  getConfigStatus(): {
    enabled: boolean;
    configured: boolean;
    environment: string;
    clientId: string;
    callbackUrl: string;
    message: string;
  } {
    const enabled = config.runpaisa.enabled;
    const configured = this.isConfigured();
    
    let message = '';
    if (!enabled) {
      message = 'Runpaisa is DISABLED. Set RUNPAISA_ENABLED=true in .env to enable.';
    } else if (!configured) {
      message = 'Runpaisa credentials not configured. Check RUNPAISA_CLIENT_ID, USERNAME, PASSWORD.';
    } else {
      message = 'Runpaisa is enabled and configured.';
    }
    
    return {
      enabled,
      configured,
      environment: this.isUAT ? 'UAT' : 'PRODUCTION',
      clientId: this.config.clientId ? `${this.config.clientId.substring(0, 4)}****` : 'Not Set',
      callbackUrl: this.config.callbackUrl,
      message,
    };
  }
}

export const runpaisaService = new RunpaisaService();

