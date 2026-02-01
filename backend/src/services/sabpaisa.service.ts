import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const IV_SIZE = 12;
const TAG_SIZE = 16;
const HMAC_LENGTH = 48;

export interface SabPaisaPaymentParams {
  clientTxnId: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  payerMobile: string;
}

export interface SabPaisaResponse {
  success: boolean;
  status: string;
  sabpaisaTxnId?: string;
  clientTxnId?: string;
  paidAmount?: number;
  paymentMode?: string;
  transDate?: string;
  bankName?: string;
  rawData?: any;
  message?: string;
}

class SabPaisaService {
  private cfg = config.sabpaisa;

  /**
   * Encrypt data for SabPaisa
   */
  private encrypt(plaintext: string): string {
    try {
      if (!this.cfg.authKey || !this.cfg.authIV) {
        throw new Error('SabPaisa Auth Key or IV not configured');
      }

      // Decode BASE64 keys
      const authKey = Buffer.from(this.cfg.authKey, 'base64');
      const authIV = Buffer.from(this.cfg.authIV, 'base64');

      // IV is first 12 bytes of authKey
      const iv = authKey.subarray(0, IV_SIZE);

      // AES-256-GCM encryption
      const cipher = crypto.createCipheriv('aes-256-gcm', authKey, iv);
      let ciphertext = cipher.update(plaintext, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const tag = cipher.getAuthTag();

      // Combine: IV + CipherText + Tag
      const encryptedMessage = Buffer.concat([iv, ciphertext, tag]);

      // HMAC-SHA384 using authIV as the key
      const hmac = crypto.createHmac('sha384', authIV)
        .update(encryptedMessage)
        .digest();

      // Final: HMAC + IV + CipherText + Tag
      const finalMessage = Buffer.concat([hmac, encryptedMessage]);
      
      return finalMessage.toString('hex').toUpperCase();
    } catch (error: any) {
      logger.error('SabPaisa encryption error:', error.message);
      throw error;
    }
  }

  /**
   * Decrypt data from SabPaisa
   */
  private decrypt(hexCiphertext: string): string {
    try {
      if (!this.cfg.authKey || !this.cfg.authIV) {
        throw new Error('SabPaisa Auth Key or IV not configured');
      }

      const authKey = Buffer.from(this.cfg.authKey, 'base64');
      const authIV = Buffer.from(this.cfg.authIV, 'base64');

      const fullMessage = Buffer.from(hexCiphertext, 'hex');

      // Extract HMAC and encrypted data
      const hmacReceived = fullMessage.subarray(0, HMAC_LENGTH);
      const encryptedData = fullMessage.subarray(HMAC_LENGTH);

      // Verify HMAC
      const hmacCalculated = crypto.createHmac('sha384', authIV)
        .update(encryptedData)
        .digest();

      if (!hmacReceived.equals(hmacCalculated)) {
        throw new Error('HMAC validation failed');
      }

      // Extract components
      const iv = encryptedData.subarray(0, IV_SIZE);
      const ciphertextWithTag = encryptedData.subarray(IV_SIZE);
      const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - TAG_SIZE);
      const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - TAG_SIZE);

      // AES-256-GCM decryption
      const decipher = crypto.createDecipheriv('aes-256-gcm', authKey, iv);
      decipher.setAuthTag(tag);
      
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error: any) {
      logger.error('SabPaisa decryption error:', error.message);
      throw error;
    }
  }

  getActionUrl() {
    return this.cfg.isProduction
      ? 'https://securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1'
      : 'https://stage-securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1';
  }

  private formatDate(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /**
   * Create payment request
   */
  createPayment(params: SabPaisaPaymentParams) {
    if (!this.cfg.enabled) {
      throw new Error('SabPaisa is disabled');
    }

    const transDate = this.formatDate(new Date());

    // Build parameter string in EXACT order
    const plainText = 
      `payerName=${params.payerName.trim()}` +
      `&payerEmail=${params.payerEmail.trim()}` +
      `&payerMobile=${params.payerMobile.trim()}` +
      `&clientTxnId=${params.clientTxnId.trim()}` +
      `&amount=${params.amount}` +
      `&clientCode=${this.cfg.clientCode.trim()}` +
      `&transUserName=${this.cfg.username.trim()}` +
      `&transUserPassword=${this.cfg.password.trim()}` +
      `&callbackUrl=${this.cfg.callbackUrl.trim()}` +
      `&channelId=W` +
      `&transDate=${transDate}`;

    logger.info(`SabPaisa creating payment for ${params.clientTxnId}, amount: ${params.amount}`);

    // Encrypt the data
    const encData = this.encrypt(plainText);

    return {
      actionUrl: this.getActionUrl(),
      clientCode: this.cfg.clientCode,
      encData: encData,
      clientTxnId: params.clientTxnId
    };
  }

  /**
   * Process callback response
   */
  processCallback(encResponse: string): SabPaisaResponse {
    try {
      const decrypted = this.decrypt(encResponse);
      
      // Parse the response
      const params: any = {};
      decrypted.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        params[key] = decodeURIComponent(value || '');
      });

      logger.info(`SabPaisa callback processed for ${params.clientTxnId}, status: ${params.status}`);

      const success = params.status === 'SUCCESS' || params.statusCode === '0000';

      return {
        success,
        status: params.status || params.statusCode,
        sabpaisaTxnId: params.sabpaisaTxnId,
        clientTxnId: params.clientTxnId,
        paidAmount: params.paidAmount ? parseFloat(params.paidAmount) : undefined,
        paymentMode: params.paymentMode,
        transDate: params.transDate,
        bankName: params.bankName,
        rawData: params,
        message: success ? 'Payment Successful' : (params.resMsg || 'Payment Failed')
      };
    } catch (error: any) {
      logger.error('SabPaisa processCallback error:', error.message);
      return {
        success: false,
        status: 'ERROR',
        message: error.message
      };
    }
  }
}

export const sabPaisaService = new SabPaisaService();
