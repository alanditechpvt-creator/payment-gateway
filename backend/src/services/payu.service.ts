/**
 * PayU India – Verify Payment API for transaction status check.
 * Used by admin "Refresh status" to reconcile PENDING transactions.
 * @see https://docs.payu.in/reference/verify_payment_api
 */

import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const VERIFY_COMMAND = 'verify_payment';

class PayUService {
  private cfg = config.payu;

  isEnabled(): boolean {
    return !!(this.cfg?.enabled && this.cfg?.key && this.cfg?.salt);
  }

  private getVerifyUrl(): string {
    return this.cfg.isProduction
      ? 'https://secure.payu.in/merchant/postservice?form=2'
      : 'https://test.payu.in/merchant/postservice?form=2';
  }

  private computeHash(var1: string): string {
    const str = `${this.cfg.key}|${VERIFY_COMMAND}|${var1}|${this.cfg.salt}`;
    return crypto.createHash('sha512').update(str).digest('hex');
  }

  /**
   * Verify transaction status via PayU verify_payment API.
   * @param transactionId – Your transaction ID (var1)
   */
  async getTransactionStatus(transactionId: string): Promise<{
    success: boolean;
    status?: 'SUCCESS' | 'FAILED' | 'PENDING';
    pgStatus?: string;
    raw?: any;
    error?: string;
  }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'PayU is disabled or not configured' };
    }
    try {
      const var1 = String(transactionId).trim();
      const hash = this.computeHash(var1);
      const url = this.getVerifyUrl();
      const body = new URLSearchParams({
        key: this.cfg.key,
        command: VERIFY_COMMAND,
        var1,
        hash,
      }).toString();

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (data.status === 0 && data.msg) {
        logger.warn(`PayU verify_payment: ${data.msg}`);
        const details = data.transaction_details?.[var1];
        if (details?.status === 'Not Found') {
          return { success: true, status: 'PENDING', pgStatus: 'Not Found', raw: data };
        }
        return { success: false, error: data.msg, raw: data };
      }

      const details = data.transaction_details?.[var1];
      if (!details) {
        return { success: false, error: 'No transaction_details in response', raw: data };
      }

      const pgStatus = (details.status || '').toLowerCase();
      let status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
      if (pgStatus === 'success' || details.unmappedstatus === 'captured') {
        status = 'SUCCESS';
      } else if (pgStatus === 'failure' || pgStatus === 'failed' || details.unmappedstatus === 'failed') {
        status = 'FAILED';
      }

      logger.info(`PayU verify_payment for ${transactionId}: pgStatus=${pgStatus} -> ${status}`);
      return { success: true, status, pgStatus: details.status, raw: details };
    } catch (error: any) {
      logger.error('PayU getTransactionStatus error:', error?.message);
      return { success: false, error: error?.message || 'Verify request failed' };
    }
  }
}

export const payuService = new PayUService();
