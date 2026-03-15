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

  // Bill Avenue requires billerId exactly 14 chars. Resolve from params, env, or Biller Info API.
  let billerId = (params.billerId || config.bbps.creditCardBillerId || '').trim().slice(0, 14);
  if (billerId.length !== 14 && config.bbps.billerIdsToFetch.length > 0) {
    try {
      const { billers } = await bbpsService.getBillerList(config.bbps.billerIdsToFetch);
      const creditCardBiller = billers.find(
        (b) =>
          /credit\s*card|loan\s*repayment/i.test(b.billerCategory) ||
          /credit\s*card|loan/i.test(b.billerName || '')
      );
      if (creditCardBiller) billerId = creditCardBiller.billerId;
    } catch (e) {
      logger.warn('Could not resolve Credit Card billerId from Biller Info', { message: (e as Error)?.message });
    }
  }
  if (billerId.length !== 14) {
    throw new AppError(
      'BBPS billerId is required (14 characters). Set BBPS_BILLER_IDS or BBPS_CREDIT_CARD_BILLER_ID in .env, or pass billerId in the request. Use GET /api/bbps/billers to fetch biller list.',
      400
    );
  }

  // Generate reference ID with Julian suffix
  const refId = generateBBPSRequestId();

  // Build XML request per BBPS doc: agentDeviceInfo, agentId, billerId, customerInfo, inputParams (order matters)
  // Credit Card biller requires inputParams: Registered Mobile No, Last 4 Digits of Credit Card
  const agentId = String(config.bbps.agentId || '').trim().slice(0, 20).padEnd(20, '0');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billFetchRequest>
<agentDeviceInfo>
<ip>72.61.254.18</ip>
<initChannel>${config.bbps.paymentChannel}</initChannel>
<mac>A1-B2-C3-D4-E5-F6</mac>
</agentDeviceInfo>
<agentId>${agentId}</agentId>
<billerId>${billerId}</billerId>
<customerInfo>
<customerMobile>${params.mobileNumber}</customerMobile>
</customerInfo>
<inputParams>
<input>
<paramName>Registered Mobile No</paramName>
<paramValue>${params.mobileNumber}</paramValue>
</input>
<input>
<paramName>Last 4 Digits of Credit Card</paramName>
<paramValue>${params.cardLast4 || '0000'}</paramValue>
</input>
</inputParams>
</billFetchRequest>`;

  logger.info('BBPS Bill Fetch Request XML:', xml);

  // Encrypt the XML (IV from config, or zero IV if BBPS_IV_USE_ZERO=true)
  const encRequest = encryptBBPSRequest(
    xml,
    config.bbps.workingKey,
    config.bbps.iv,
    config.bbps.ivUseZero
  );
  
  logger.info('BBPS Encrypted Request:', { length: encRequest.length, sample: encRequest.substring(0, 80) + '...' });

  // Confirm config is loaded (do not log secrets)
  const hasCreds = !!(config.bbps.accessCode && config.bbps.workingKey);
  logger.info('BBPS request', {
    endpoint: config.bbps.endpoints.billFetch,
    credentialsLoaded: hasCreds,
  });

  const fs = require('fs');
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: config.bbps.endpoints.billFetch,
    credentialsLoaded: hasCreds,
    xml: xml,
    encRequestLength: encRequest.length,
    encRequestSample: encRequest.substring(0, 200),
    fullEncRequest: encRequest,
  };
  fs.writeFileSync('./bbps-debug-request.json', JSON.stringify(debugInfo, null, 2));

  if (!config.bbps.instituteId) {
    throw new AppError('BBPS instituteId (BBPS_AGENT_INSTITUTION_ID) is not configured', 500);
  }

  try {
    // Bill Avenue required POST params: accessCode, requestId, encRequest, ver, instituteId
    const requestId = generateBBPSRequestId();
    const formParams = new URLSearchParams();
    formParams.append('accessCode', config.bbps.accessCode);
    formParams.append('requestId', requestId);
    formParams.append('encRequest', encRequest);
    formParams.append('ver', '1.0');
    formParams.append('instituteId', config.bbps.instituteId);

    const response = await axios.post(
      config.bbps.endpoints.billFetch,
      formParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Detect HTML error pages (e.g. Bill Avenue "Access Denied" / IP or credential rejection)
    const raw = response.data;
    if (typeof raw === 'string') {
      const lower = raw.toLowerCase();
      if (
        (lower.includes('access denied') || lower.includes('unauthorized access')) &&
        (lower.includes('<html') || lower.includes('<!doctype'))
      ) {
        logger.error('BBPS API returned HTML access denied page', {
          contentType: response.headers?.['content-type'],
          preview: raw.substring(0, 400),
        });
        throw new AppError(
          'BBPS access denied. Check with the provider: credentials (accessCode/workingKey) and IP whitelisting for this server.',
          403
        );
      }
    }

    // Normalize response: API may return string (form-urlencoded or JSON)
    let data: Record<string, unknown> | string = response.data;
    if (typeof data === 'string') {
      const contentType = (response.headers?.['content-type'] || '').toLowerCase();
      if (
        contentType.includes('x-www-form-urlencoded') ||
        data.includes('encResponse=') ||
        data.includes('enc_response=') ||
        data.includes('encData=')
      ) {
        data = Object.fromEntries(new URLSearchParams(data)) as Record<string, unknown>;
      } else if (data.trim().startsWith('{')) {
        try {
          data = JSON.parse(data) as Record<string, unknown>;
        } catch {
          // keep as string
        }
      }
    }

    // Write response debug to file
    const responseDebug = {
      timestamp: new Date().toISOString(),
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers?.['content-type'],
      dataType: typeof data,
      dataKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [],
      dataPreview: typeof data === 'string' ? data.substring(0, 500) : data,
    };
    fs.writeFileSync('./bbps-debug-response.json', JSON.stringify(responseDebug, null, 2));

    logger.info('BBPS API Response Status:', response.status);
    logger.info('BBPS API Response dataType:', typeof data);
    if (typeof data === 'string') {
      logger.info('BBPS API Response Data (preview):', data.substring(0, 300));
    } else {
      logger.info('BBPS API Response Data:', JSON.stringify(data, null, 2));
    }

    // Bill Avenue may return encResponse/enc_response/encData in form, or raw hex body
    const strData = typeof data === 'string' ? data.trim() : '';
    const objData = typeof data === 'object' && data && !Array.isArray(data) ? data : null;
    // Encrypted payload: form keys, raw hex body, or base64 body (convert to hex for decrypt)
    const rawHex =
      strData && /^[0-9a-fA-F]+$/.test(strData) && strData.length >= 32 && strData.length % 2 === 0 ? strData : null;
    const base64Decoded =
      strData &&
      strData.length >= 32 &&
      /^[A-Za-z0-9+/]+=*$/.test(strData) &&
      strData.length % 4 === 0
        ? Buffer.from(strData, 'base64').toString('hex')
        : null;
    const encResponse =
      (objData && (objData.encResponse as string)) ??
      (objData && (objData.enc_response as string)) ??
      (objData && (objData.encData as string)) ??
      (objData && (objData.enc_data as string)) ??
      rawHex ??
      (base64Decoded && base64Decoded.length >= 32 ? base64Decoded : null);

    // If response is plain XML (e.g. /xml endpoint returning decrypted XML)
    if (strData && (strData.startsWith('<?xml') || strData.startsWith('<billFetchResponse') || (strData.startsWith('<') && strData.includes('billFetchResponse')))) {
      const codeMatch = strData.match(/<responseCode>(.*?)<\/responseCode>/i);
      const code = codeMatch ? codeMatch[1].trim() : '';
      if (code && code !== '000') {
        const errMsgMatch = strData.match(/<errorMessage>(.*?)<\/errorMessage>/i);
        throw new AppError(errMsgMatch ? errMsgMatch[1].trim() : `BBPS error (code ${code})`, 400);
      }
      logger.info('BBPS API returned plain XML (no decryption)');
      const billDataPlain = parseXMLResponse(strData);
      const savedBillPlain = await prisma.cachedBill.create({
        data: {
          userId,
          category: 'CREDIT_CARD',
          billerId: billerId,
          billerName: billDataPlain.billerName || 'Credit Card',
          mobileNumber: params.mobileNumber,
          cardLast4: params.cardLast4 || billDataPlain.cardLast4 || '',
          billNumber: billDataPlain.billNumber || refId,
          billDate: billDataPlain.billDate ? new Date(billDataPlain.billDate) : new Date(),
          dueDate: billDataPlain.dueDate ? new Date(billDataPlain.dueDate) : new Date(),
          amount: billDataPlain.amount || 0,
          customerName: billDataPlain.customerName || '',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          rawResponse: strData,
        },
      });
      return {
        success: true,
        cached: false,
        data: {
          id: savedBillPlain.id,
          billerName: savedBillPlain.billerName,
          amount: savedBillPlain.amount || 0,
          dueDate: savedBillPlain.dueDate,
          billDate: savedBillPlain.billDate,
          billNumber: savedBillPlain.billNumber,
          customerName: savedBillPlain.customerName,
          status: savedBillPlain.status,
          cardLast4: savedBillPlain.cardLast4,
        },
      };
    }

    if (!data || !encResponse) {
      const msg =
        typeof data === 'object' &&
        data &&
        ((data.message as string) || (data.errorMessage as string) || (data.error as string));
      const debug = {
        dataType: typeof data,
        hasEncResponse: !!encResponse,
        dataKeys: typeof data === 'object' && data && !Array.isArray(data) ? Object.keys(data) : [],
        fullResponse: typeof data === 'string' ? data.substring(0, 800) : data,
      };
      logger.error('Invalid BBPS response structure: ' + JSON.stringify(debug));
      throw new AppError((msg as string) || 'Invalid response from BBPS', 500);
    }

    // Decrypt response (same IV as encrypt)
    let decrypted: string;
    try {
      decrypted = decryptBBPSResponse(
        encResponse,
        config.bbps.workingKey,
        config.bbps.iv,
        config.bbps.ivUseZero
      );
    } catch (decErr: any) {
      logger.error('BBPS response decryption failed', { message: decErr?.message });
      throw new AppError('Invalid or corrupted response from BBPS', 500);
    }
    logger.info('Decrypted BBPS Response:', decrypted);

    // Bill Avenue success = responseCode 000 (per BBPS doc)
    const responseCodeMatch = decrypted.match(/<responseCode>(.*?)<\/responseCode>/i);
    const responseCode = responseCodeMatch ? responseCodeMatch[1].trim() : '';
    if (responseCode && responseCode !== '000') {
      const errMsgMatch = decrypted.match(/<errorMessage>(.*?)<\/errorMessage>/i);
      const errCodeMatch = decrypted.match(/<errorCode>(.*?)<\/errorCode>/i);
      const errMsg = errMsgMatch ? errMsgMatch[1].trim() : `BBPS error (code ${responseCode})`;
      const errCode = errCodeMatch ? errCodeMatch[1].trim() : '';
      logger.error('BBPS API error response', { responseCode, errCode, errMsg });
      throw new AppError(errMsg, 400);
    }

    // Parse XML response
    const billData = parseXMLResponse(decrypted);

    // Store bill in database
    const savedBill = await prisma.cachedBill.create({
      data: {
        userId,
        category: 'CREDIT_CARD',
        billerId: billerId,
        billerName: billData.billerName || 'Credit Card',
        mobileNumber: params.mobileNumber,
        cardLast4: params.cardLast4 || billData.cardLast4 || '',
        billNumber: billData.billNumber || refId,
        billDate: billData.billDate ? new Date(billData.billDate) : new Date(),
        dueDate: billData.dueDate ? new Date(billData.dueDate) : new Date(),
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
      billerId: existingBill.billerId || undefined,
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
          dueDate: freshData.data.dueDate ? new Date(freshData.data.dueDate) : new Date(),
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
   * Biller Info (MDM) API – fetch biller details for given IDs (1–2000).
   * Use to get list of billers and pick Credit Card billerId. Doc: at least 1 biller ID required.
   */
  async getBillerList(billerIds: string[]): Promise<{ billers: Array<{ billerId: string; billerName: string; billerCategory: string; billerAliasName?: string }> }> {
    if (!config.bbps.enabled) {
      throw new AppError('BBPS service is disabled', 400);
    }
    const ids = billerIds.map((id) => String(id).trim().slice(0, 14)).filter((id) => id.length === 14);
    if (ids.length === 0) {
      throw new AppError('At least one valid 14-character billerId is required. Set BBPS_BILLER_IDS in .env or pass billerIds.', 400);
    }
    if (ids.length > 2000) {
      throw new AppError('Maximum 2000 biller IDs allowed per request', 400);
    }
    if (!config.bbps.instituteId) {
      throw new AppError('BBPS instituteId (BBPS_AGENT_INSTITUTION_ID) is not configured', 500);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billerInfoRequest>
${ids.map((id) => `<billerId>${id}</billerId>`).join('\n')}
</billerInfoRequest>`;

    const encRequest = encryptBBPSRequest(
      xml,
      config.bbps.workingKey,
      config.bbps.iv,
      config.bbps.ivUseZero
    );
    const requestId = generateBBPSRequestId();
    const params = new URLSearchParams();
    params.append('accessCode', config.bbps.accessCode);
    params.append('requestId', requestId);
    params.append('encRequest', encRequest);
    params.append('ver', '1.0');
    params.append('instituteId', config.bbps.instituteId);

    const response = await axios.post(
      config.bbps.endpoints.billerMdm,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const raw = response.data;
    if (typeof raw === 'string') {
      const lower = raw.toLowerCase();
      if (
        (lower.includes('access denied') || lower.includes('unauthorized access')) &&
        (lower.includes('<html') || lower.includes('<!doctype'))
      ) {
        throw new AppError('BBPS access denied. Check credentials and IP whitelisting.', 403);
      }
    }

    let data: Record<string, unknown> | string = response.data;
    if (typeof data === 'string') {
      if (
        (response.headers?.['content-type'] || '').toLowerCase().includes('x-www-form-urlencoded') ||
        (data.includes('encResponse=') || data.includes('enc_response=') || data.includes('encData='))
      ) {
        data = Object.fromEntries(new URLSearchParams(data)) as Record<string, unknown>;
      } else if (data.trim().startsWith('{')) {
        try {
          data = JSON.parse(data) as Record<string, unknown>;
        } catch {
          // keep string
        }
      }
    }

    const strData = typeof data === 'string' ? data.trim() : '';
    const objData = typeof data === 'object' && data && !Array.isArray(data) ? data : null;
    const encResponse =
      (objData && (objData.encResponse as string)) ??
      (objData && (objData.enc_response as string)) ??
      (objData && (objData.encData as string)) ??
      (objData && (objData.enc_data as string)) ??
      (strData && /^[0-9a-fA-F]+$/.test(strData) && strData.length >= 32 && strData.length % 2 === 0 ? strData : null);

    let decrypted: string;
    if (strData && (strData.startsWith('<?xml') || strData.startsWith('<billerInfoResponse') || (strData.startsWith('<') && strData.includes('billerInfoResponse')))) {
      decrypted = strData;
    } else if (encResponse) {
      try {
        decrypted = decryptBBPSResponse(
          encResponse,
          config.bbps.workingKey,
          config.bbps.iv,
          config.bbps.ivUseZero
        );
      } catch (e) {
        logger.error('Biller Info decryption failed', { message: (e as Error)?.message });
        throw new AppError('Invalid response from BBPS Biller Info', 500);
      }
    } else {
      throw new AppError('Invalid response from BBPS Biller Info', 500);
    }

    const codeMatch = decrypted.match(/<responseCode>(.*?)<\/responseCode>/i);
    const code = codeMatch ? codeMatch[1].trim() : '';
    if (code && code !== '000') {
      const errMsgMatch = decrypted.match(/<errorMessage>(.*?)<\/errorMessage>/i);
      throw new AppError(errMsgMatch ? errMsgMatch[1].trim() : `BBPS Biller Info error (code ${code})`, 400);
    }

    const billers = parseBillerInfoResponse(decrypted);
    return { billers };
  },

  /**
   * Get billers from DB (optionally filter by category e.g. CREDIT_CARD).
   * Use after sync so users can select bank (ICICI, Axis, HDFC, SBI, etc.).
   */
  async getBillersFromDb(category?: string): Promise<Array<{ billerId: string; billerName: string; billerAliasName?: string; billerCategory?: string }>> {
    const list = await prisma.bbpsBiller.findMany({
      orderBy: [{ sortOrder: 'asc' }, { billerName: 'asc' }],
    });
    if (!category || !category.trim()) {
      return list.map((x) => ({
        billerId: x.billerId,
        billerName: x.billerName,
        billerAliasName: x.billerAliasName ?? undefined,
        billerCategory: x.billerCategory ?? undefined,
      }));
    }
    const c = category.trim().toLowerCase();
    const isCreditCard = c === 'credit_card' || c === 'credit card' || c.includes('credit');
    const filtered = list.filter((x) => {
      const cat = (x.billerCategory || '').toLowerCase();
      const name = (x.billerName || '').toLowerCase();
      const alias = (x.billerAliasName || '').toLowerCase();
      if (isCreditCard) return cat.includes('credit') || name.includes('credit') || alias.includes('credit');
      return cat.includes(c) || name.includes(c) || alias.includes(c);
    });
    return filtered.map((x) => ({
      billerId: x.billerId,
      billerName: x.billerName,
      billerAliasName: x.billerAliasName ?? undefined,
      billerCategory: x.billerCategory ?? undefined,
    }));
  },

  /**
   * Import billers from Excel/CSV file (e.g. Bharat Connect_biller-info.xlsx).
   * Filters by Credit Card category and upserts into BbpsBiller.
   * When you update the file, re-upload or re-call this to reload.
   */
  async importBillersFromFile(buffer: Buffer, filename: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const ext = (filename || '').toLowerCase().split('.').pop();
    let rows: Record<string, unknown>[] = [];
    try {
      if (ext === 'csv') {
        const str = buffer.toString('utf8');
        const lines = str.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new AppError('CSV must have header row and at least one data row', 400);
        const headers = parseCSVLine(lines[0]);
        rows = lines.slice(1).map((line) => {
          const values = parseCSVLine(line);
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            obj[h] = values[i] ?? '';
          });
          return obj;
        });
      } else {
        let XLSX: any;
        try {
          XLSX = require('xlsx');
        } catch {
          throw new AppError('xlsx module not found. In backend folder run: npm install', 500);
        }
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new AppError('Excel file has no sheet', 400);
        rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet]) as Record<string, unknown>[];
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      logger.error('Parse biller file failed', { message: e?.message });
      throw new AppError('Invalid file. Use Excel (.xlsx, .xls) or CSV with header row.', 400);
    }
    const normalized = rows.map((r) => normalizeBillerRow(r));
    const creditCardOnly = normalized.filter((r) => {
      const cat = (r.billerCategory || '').toString().toLowerCase();
      return cat.includes('credit');
    });
    const TOP_BILLER_NAMES = ['axis', 'icici', 'hdfc', 'sbi'];
    const TOP_ORDER: Record<string, number> = { sbi: 1, hdfc: 2, icici: 3, axis: 4 };
    let imported = 0;
    const errors: string[] = [];
    for (const r of creditCardOnly) {
      const id = String(r.billerId || '').trim().slice(0, 14);
      if (id.length !== 14) {
        errors.push(`Invalid or missing billerId: ${id || '(empty)'}`);
        continue;
      }
      const name = (r.billerName || r.billerAliasName || id).toString().trim() || id;
      const category = (r.billerCategory || '').toString().trim();
      const alias = (r.billerAliasName || '').toString().trim() || null;
      const nameLower = name.toLowerCase();
      const isTop = TOP_BILLER_NAMES.some((t) => nameLower.includes(t));
      const sortOrder = isTop ? (TOP_ORDER[TOP_BILLER_NAMES.find((t) => nameLower.includes(t))!] ?? 50) : 100;
      try {
        await prisma.bbpsBiller.upsert({
          where: { billerId: id },
          create: {
            billerId: id,
            billerName: name,
            billerAliasName: alias,
            billerCategory: category,
            isTopBiller: isTop,
            sortOrder,
          },
          update: {
            billerName: name,
            billerAliasName: alias,
            billerCategory: category,
            isTopBiller: isTop,
            sortOrder,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${id}: ${e?.message || 'DB error'}`);
      }
    }
    const skipped = normalized.length - creditCardOnly.length;
    logger.info('Biller import from file', { filename, imported, skipped, errors: errors.length });
    return { imported, skipped, errors };
  },

  /**
   * Fetch a single biller from Bill Avenue (Biller Info API) and store in DB.
   * Use when user/admin adds a biller by 14-char ID so we can show it in the dropdown.
   */
  async fetchOneBillerAndStore(billerId: string): Promise<{ billerId: string; billerName: string; billerAliasName?: string; billerCategory?: string }> {
    const id = String(billerId).trim().slice(0, 14);
    if (id.length !== 14) {
      throw new AppError('Biller ID must be exactly 14 characters.', 400);
    }
    const { billers } = await bbpsService.getBillerList([id]);
    if (!billers.length) {
      throw new AppError('Biller not found for this ID. Check with Bill Avenue.', 404);
    }
    const b = billers[0];
    const name = (b.billerName || b.billerAliasName || '').toLowerCase();
    const TOP_BILLER_NAMES = ['axis', 'icici', 'hdfc', 'sbi'];
    const TOP_ORDER: Record<string, number> = { sbi: 1, hdfc: 2, icici: 3, axis: 4 };
    const isTop = TOP_BILLER_NAMES.some((t) => name.includes(t));
    const sortOrder = isTop ? (TOP_ORDER[TOP_BILLER_NAMES.find((t) => name.includes(t))!] ?? 50) : 100;
    await prisma.bbpsBiller.upsert({
      where: { billerId: b.billerId },
      create: {
        billerId: b.billerId,
        billerName: b.billerName,
        billerAliasName: b.billerAliasName,
        billerCategory: b.billerCategory,
        isTopBiller: isTop,
        sortOrder,
      },
      update: {
        billerName: b.billerName,
        billerAliasName: b.billerAliasName,
        billerCategory: b.billerCategory,
        isTopBiller: isTop,
        sortOrder,
      },
    });
    return {
      billerId: b.billerId,
      billerName: b.billerName,
      billerAliasName: b.billerAliasName,
      billerCategory: b.billerCategory,
    };
  },

  /** Sync billers from Bill Avenue into DB. Uses body.billerIds if provided, else BBPS_BILLER_IDS. Top billers: Axis, ICICI, HDFC, SBI. */
  async syncBillersToDb(billerIdsFromRequest?: string[]): Promise<{ synced: number; billers: Array<{ billerId: string; billerName: string; isTopBiller: boolean }> }> {
    const ids =
      Array.isArray(billerIdsFromRequest) && billerIdsFromRequest.length > 0
        ? billerIdsFromRequest.map((id) => String(id).trim().slice(0, 14)).filter((id) => id.length === 14)
        : config.bbps.billerIdsToFetch;
    if (ids.length === 0) {
      throw new AppError(
        'Provide billerIds in request body (array of 14-char IDs) or set BBPS_BILLER_IDS in .env to sync billers.',
        400
      );
    }
    const { billers } = await bbpsService.getBillerList(ids);
    const TOP_BILLER_NAMES = ['axis', 'icici', 'hdfc', 'sbi'];
    const TOP_ORDER: Record<string, number> = { sbi: 1, hdfc: 2, icici: 3, axis: 4 };
    let synced = 0;
    for (const b of billers) {
      const name = (b.billerName || b.billerAliasName || '').toLowerCase();
      const isTop = TOP_BILLER_NAMES.some((t) => name.includes(t));
      const sortOrder = isTop
        ? (TOP_ORDER[TOP_BILLER_NAMES.find((t) => name.includes(t))!] ?? 50)
        : 100;
      await prisma.bbpsBiller.upsert({
        where: { billerId: b.billerId },
        create: {
          billerId: b.billerId,
          billerName: b.billerName,
          billerAliasName: b.billerAliasName,
          billerCategory: b.billerCategory,
          isTopBiller: isTop,
          sortOrder,
        },
        update: {
          billerName: b.billerName,
          billerAliasName: b.billerAliasName,
          billerCategory: b.billerCategory,
          isTopBiller: isTop,
          sortOrder,
        },
      });
      synced++;
    }
    const list = await prisma.bbpsBiller.findMany({ orderBy: [{ sortOrder: 'asc' }, { billerName: 'asc' }] });
    return {
      synced,
      billers: list.map((x) => ({ billerId: x.billerId, billerName: x.billerName, isTopBiller: x.isTopBiller })),
    };
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

/**
 * Bill Avenue requestId: alphanumeric 35 chars.
 * Format: <random 27 chars>;<YDDDhhmm>
 * Y = last digit of year, DDD = day of year, hh = 24h hour, mm = minutes.
 */
function generateBBPSRequestId(): string {
  const alphanumeric = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let random = '';
  for (let i = 0; i < 27; i++) {
    random += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  const now = new Date();
  const Y = String(now.getFullYear()).slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const DDD = String(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))).padStart(3, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${random};${Y}${DDD}${hh}${mm}`;
}

/**
 * Parse Biller Info (MDM) XML response into array of billers
 */
function parseBillerInfoResponse(xml: string): Array<{ billerId: string; billerName: string; billerCategory: string; billerAliasName?: string }> {
  const billers: Array<{ billerId: string; billerName: string; billerCategory: string; billerAliasName?: string }> = [];
  const billerBlocks = xml.match(/<biller>[\s\S]*?<\/biller>/gi) || [];
  for (const block of billerBlocks) {
    const getVal = (tag: string): string => {
      const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
      const m = block.match(re);
      return m ? m[1].trim() : '';
    };
    const billerId = getVal('billerId');
    if (!billerId) continue;
    billers.push({
      billerId,
      billerName: getVal('billerName') || getVal('billerAliasName') || billerId,
      billerCategory: getVal('billerCategory') || '',
      billerAliasName: getVal('billerAliasName') || undefined,
    });
  }
  return billers;
}

/**
 * Parse XML response from BillAvenue (bill fetch / bill payment)
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

/** Parse a single CSV line (handles quoted fields) */
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Normalize Excel/CSV row to { billerId, billerName, billerCategory, billerAliasName } using common column names */
function normalizeBillerRow(row: Record<string, unknown>): { billerId: string; billerName: string; billerCategory: string; billerAliasName: string } {
  const key = (v: string) => v.toLowerCase().replace(/\s+/g, '');
  const get = (...names: string[]) => {
    for (const n of names) {
      const k = Object.keys(row).find((r) => key(r) === key(n));
      if (k != null && row[k] != null) return String(row[k]).trim();
    }
    return '';
  };
  return {
    billerId: get('biller id', 'billerid', 'biller_id', 'Biller ID'),
    billerName: get('biller name', 'billername', 'biller_name', 'Biller Name'),
    billerCategory: get('biller category', 'billercategory', 'biller_category', 'Biller Category', 'category'),
    billerAliasName: get('biller alias', 'billeraliasname', 'alias', 'Biller Alias Name'),
  };
}
