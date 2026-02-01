import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { transactionService } from './transaction.service';
import { config } from '../config';
import axios from 'axios';
import { encryptBBPSRequest, decryptBBPSResponse } from '../utils/bbps-encrypt';
import prisma from '../lib/prisma';

export const bbpsService = {
  async fetchBill(userId: string, category: string, params: { mobileNumber?: string; cardLast4?: string; billerId?: string }) {
  logger.info(`Fetching BBPS bill for user ${userId}, category: ${category}`, params);

  if (!config.bbps.enabled) {
    throw new AppError('BBPS service is disabled', 400);
  }

  if (category !== 'CREDIT_CARD') {
    throw new AppError('Category not supported yet', 400);
  }
  if (!params.mobileNumber || params.mobileNumber.length < 10) {
    throw new AppError('Invalid mobile number', 400);
  }

  // Check cached bill first
  const cachedBill = await prisma.cachedBill.findFirst({
    where: {
      userId,
      mobileNumber: params.mobileNumber,
      expiresAt: { gt: new Date() },
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (cachedBill && cachedBill.dueDate && new Date(cachedBill.dueDate) > new Date()) {
    logger.info(`Returning cached bill for ${params.mobileNumber}`);
    return {
      success: true,
      cached: true,
      data: {
        billerName: cachedBill.billerName,
        amount: cachedBill.amount || 0,
        dueDate: cachedBill.dueDate,
        billDate: cachedBill.billDate,
        billNumber: cachedBill.billNumber,
        customerName: cachedBill.customerName,
        status: cachedBill.status,
        cardLast4: cachedBill.cardLast4,
      },
    };
  }

  // Generate reference ID with Julian suffix
  const refId = generateBBPSRequestId();

  // Build XML request for BillAvenue
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billFetchRequest>
  <agentId>${config.bbps.agentId}</agentId>
  <billerId>${params.billerId || ''}</billerId>
  <agentDeviceInfo>
    <ip>127.0.0.1</ip>
    <initChannel>AGT</initChannel>
  </agentDeviceInfo>
  <customerInfo>
    <customerMobile>${params.mobileNumber}</customerMobile>
  </customerInfo>
</billFetchRequest>`;

  logger.info('BBPS Bill Fetch Request XML:', xml);

  // Encrypt the XML
  const encRequest = encryptBBPSRequest(xml, config.bbps.workingKey);

  // Write debug info to file
  const fs = require('fs');
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: config.bbps.endpoints.billFetch,
    accessCode: config.bbps.accessCode,
    xml: xml,
    encRequestLength: encRequest.length,
    encRequestSample: encRequest.substring(0, 200),
  };
  fs.writeFileSync('./bbps-debug-request.json', JSON.stringify(debugInfo, null, 2));

  try {
    // Try different request formats
    const requestBody = `encRequest=${encodeURIComponent(encRequest)}`;
    
    const response = await axios.post(
      `${config.bbps.endpoints.billFetch}?accessCode=${config.bbps.accessCode}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Write response debug to file
    const responseDebug = {
      timestamp: new Date().toISOString(),
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      dataType: typeof response.data,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      data: response.data,
    };
    fs.writeFileSync('./bbps-debug-response.json', JSON.stringify(responseDebug, null, 2));

    logger.info('BBPS API Response Status:', response.status);
    logger.info('BBPS API Response Data:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.encResponse) {
      logger.error('Invalid BBPS response structure:', {
        hasData: !!response.data,
        hasEncResponse: !!(response.data && response.data.encResponse),
        responseKeys: response.data ? Object.keys(response.data) : [],
        fullResponse: JSON.stringify(response.data, null, 2),
      });
      throw new AppError('Invalid response from BBPS', 500);
    }

    // Decrypt response
    const decrypted = decryptBBPSResponse(response.data.encResponse, config.bbps.workingKey);
    logger.info('Decrypted BBPS Response:', decrypted);

    // Parse XML response
    const billData = parseXMLResponse(decrypted);

    // Store bill in database
    const savedBill = await prisma.cachedBill.create({
      data: {
        userId,
        category: 'CREDIT_CARD',
        billerId: params.billerId || '',
        billerName: billData.billerName || 'Credit Card',
        mobileNumber: params.mobileNumber,
        cardLast4: params.cardLast4 || billData.cardLast4 || '',
        billNumber: billData.billNumber || refId,
        billDate: billData.billDate ? new Date(billData.billDate) : new Date(),
        dueDate: billData.dueDate ? new Date(billData.dueDate) : null,
        amount: billData.amount || 0,
        customerName: billData.customerName || '',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        rawResponse: decrypted,
      },
    });

    return {
      success: true,
      cached: false,
      data: {
        id: savedBill.id,
        billerName: savedBill.billerName,
        amount: savedBill.amount || 0,
        dueDate: savedBill.dueDate,
        billDate: savedBill.billDate,
        billNumber: savedBill.billNumber,
        customerName: savedBill.customerName,
        status: savedBill.status,
        cardLast4: savedBill.cardLast4,
      },
    };
  } catch (error: any) {
    logger.error('BBPS API call failed - Full Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      requestUrl: error.config?.url,
      requestData: error.config?.data,
    });
    throw new AppError(
      error.response?.data?.message || error.message || 'Failed to fetch bill from BBPS',
      error.response?.status || 500
    );
  }
  },

  /**
   * Refresh bill data (check if due date changed)
   */
  async refreshBill(billId: string, userId: string) {
    logger.info(`Refreshing bill ${billId} for user ${userId}`);

    const existingBill = await prisma.cachedBill.findFirst({
      where: { id: billId, userId },
    });

    if (!existingBill) {
      throw new AppError('Bill not found', 404);
    }

    // Fetch fresh bill data
    const freshData = await this.fetchBill(userId, 'CREDIT_CARD', {
      mobileNumber: existingBill.mobileNumber,
      billerId: existingBill.billerId,
      cardLast4: existingBill.cardLast4 || undefined,
    });

    // Check if due date or amount changed
    const dueDateChanged = freshData.data.dueDate?.toISOString() !== existingBill.dueDate?.toISOString();
    const amountChanged = freshData.data.amount !== (existingBill.amount || 0);

    if (dueDateChanged || amountChanged) {
      await prisma.cachedBill.update({
        where: { id: billId },
        data: {
          amount: freshData.data.amount,
          dueDate: freshData.data.dueDate ? new Date(freshData.data.dueDate) : null,
          billDate: freshData.data.billDate ? new Date(freshData.data.billDate) : undefined,
          updatedAt: new Date(),
        },
      });

      logger.info(`Bill ${billId} refreshed - changes detected`);
      return { success: true, updated: true, changes: { dueDateChanged, amountChanged }, data: freshData.data };
    }

    logger.info(`Bill ${billId} is up to date`);
    return { success: true, updated: false, data: freshData.data };
  },

  /**
   * Get all bills for a user
   */
  async getUserBills(userId: string, filters?: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const bills = await prisma.cachedBill.findMany({
      where: {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return bills.map(bill => ({
      ...bill,
      amount: bill.amount || 0,
    }));
  },
  async payBill(userId: string, data: {
    amount: number;
    mobileNumber: string;
    cardLast4: string;
    billerName: string;
    pgId: string;
  }) {
    logger.info(`Initiating BBPS payment for user ${userId}`, data);

    // Use transaction service to create a transaction of type CC_PAYMENT
    // This will handle wallet deduction, permission checks, etc.
    const transaction = await transactionService.createTransaction(userId, {
      amount: data.amount,
      type: 'CC_PAYMENT' as any, // Cast to any until we update the type definition
      pgId: data.pgId,
      description: `CC Bill Payment - ${data.billerName} (${data.cardLast4})`,
      metadata: {
        mobileNumber: data.mobileNumber,
        cardLast4: data.cardLast4,
        billerName: data.billerName,
        category: 'CREDIT_CARD'
      }
    });

    return {
      success: true,
      message: 'Payment initiated successfully',
      transactionId: transaction.id,
      status: transaction.status
    };
  }
};

function generateBBPSRequestId(): string {
  // <random 27 characters><YDDDhhmm>
  const random = Math.random().toString(36).substring(2, 29).padEnd(27, 'X');
  const now = new Date();
  const year = now.getFullYear();
  const Y = String(year).slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const DDD = String(Math.floor(diff / oneDay)).padStart(3, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${random}${Y}${DDD}${hh}${mm}`;
}

/**
 * Parse XML response from BillAvenue
 * Simplified parser - consider using xml2js for production
 */
function parseXMLResponse(xml: string): any {
  const getTagValue = (tag: string): string => {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  };

  return {
    billerName: getTagValue('billerName') || getTagValue('billerAliasName') || 'Credit Card',
    amount: parseFloat(getTagValue('amount') || getTagValue('billAmount') || '0'),
    dueDate: getTagValue('dueDate') || getTagValue('billDueDate'),
    billDate: getTagValue('billDate') || getTagValue('billGenerationDate'),
    billNumber: getTagValue('billNumber') || getTagValue('billReferenceNumber'),
    customerName: getTagValue('customerName'),
    cardLast4: getTagValue('cardLast4') || getTagValue('last4Digits'),
  };
}
