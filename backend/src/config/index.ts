// ...existing code...
// Only keep the main config export below, with BBPS block inside
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  adminOverrideEnabled: process.env.ADMIN_OVERRIDE_ENABLED === 'true',
  port: parseInt(process.env.PORT || '4100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h', // Extended for development
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5000', 'http://localhost:5002', 'http://127.0.0.1:5000', 'http://127.0.0.1:5002'],
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@newweb.com',
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@newweb.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  },
  
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },
  
  // Storage optimization settings
  storage: {
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3' | 'azure' | 'gcs') || 'local',
    imageCompression: process.env.IMAGE_COMPRESSION !== 'false', // Default true
    maxImageWidth: parseInt(process.env.MAX_IMAGE_WIDTH || '1920', 10),
    maxImageHeight: parseInt(process.env.MAX_IMAGE_HEIGHT || '1920', 10),
    imageQuality: parseInt(process.env.IMAGE_QUALITY || '80', 10),
    cacheDuration: parseInt(process.env.CACHE_DURATION || '2592000', 10), // 30 days in seconds
    
    // AWS S3 (for future use)
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    
    // Azure Blob (for future use)
    azure: {
      containerName: process.env.AZURE_CONTAINER_NAME || '',
      connectionString: process.env.AZURE_CONNECTION_STRING || '',
    },
    
    // Google Cloud Storage (for future use)
    gcs: {
      bucket: process.env.GCS_BUCKET || '',
      projectId: process.env.GCS_PROJECT_ID || '',
      keyFilename: process.env.GCS_KEY_FILENAME || '',
    },
  },
  
  urls: {
    mainApp: process.env.MAIN_APP_URL || 'http://localhost:5000',
    adminApp: process.env.ADMIN_APP_URL || 'http://localhost:5002',
  },
  
  // Payment Gateway: Runpaisa
  runpaisa: {
    // Set to false to disable Runpaisa API calls (use mock payment links)
    enabled: process.env.RUNPAISA_ENABLED === 'true',
    clientId: process.env.RUNPAISA_CLIENT_ID || '',
    username: process.env.RUNPAISA_USERNAME || '',
    password: process.env.RUNPAISA_PASSWORD || '',
    callbackUrl: process.env.RUNPAISA_CALLBACK_URL || 'http://localhost:4100/api/webhooks/runpaisa',
  },

  // Payment Gateway: Cashfree
  cashfree: {
    enabled: process.env.CASHFREE_ENABLED === 'true',
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    env: (process.env.CASHFREE_ENV || 'TEST') as 'TEST' | 'PROD',
    callbackUrl: process.env.CASHFREE_CALLBACK_URL || 'http://localhost:4100/api/webhooks/cashfree',
  },

  // Payment Gateway: Razorpay
  razorpay: {
    enabled: process.env.RAZORPAY_ENABLED === 'true',
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    callbackUrl: process.env.RAZORPAY_CALLBACK_URL || 'http://localhost:4100/api/webhooks/razorpay',
  },

  // Payment Gateway: SabPaisa
  sabpaisa: {
    enabled: process.env.SABPAISA_ENABLED === 'true',
    clientCode: process.env.SABPAISA_CLIENT_CODE || '',
    username: process.env.SABPAISA_USERNAME || '',
    password: process.env.SABPAISA_PASSWORD || '',
    authKey: process.env.SABPAISA_AUTH_KEY || '',
    authIV: process.env.SABPAISA_AUTH_IV || '',
    callbackUrl: process.env.SABPAISA_CALLBACK_URL || 'http://localhost:4100/api/webhooks/sabpaisa',
    isProduction: process.env.SABPAISA_PRODUCTION === 'true',
  },

  // Payment Gateway: BBPS (Live API)
  bbps: (() => {
    const isProduction = process.env.BBPS_ENDPOINT === 'production';
    const baseUrl = isProduction 
      ? 'https://api.billavenue.com/billpay' 
      : 'https://uat.billavenue.com/billpay';
    
    return {
      enabled: process.env.BBPS_ENABLED === 'true',
      accessCode: process.env.BBPS_ACCESS_CODE || '',
      workingKey: process.env.BBPS_WORKING_KEY || '',
      agentId: process.env.BBPS_AGENT_ID || '',
      instituteId: process.env.BBPS_AGENT_INSTITUTION_ID || '',
      instituteName: process.env.BBPS_AGENT_INSTITUTION_NAME || '',
      paymentChannel: process.env.BBPS_PAYMENT_CHANNEL || 'AGT',
      endpoints: {
        billerMdm: `${baseUrl}/extMdmCntrl/mdmRequestNew/xml`,
        billFetch: `${baseUrl}/extBillCntrl/billFetchRequest/xml`,
        billPayment: `${baseUrl}/extBillPayCntrl/billPayRequest/xml`,
        complaintRegistration: `${baseUrl}/extComplaints/register/xml`,
        complaintTracking: `${baseUrl}/extComplaints/track/xml`,
        transactionStatus: `${baseUrl}/transactionStatus/fetchInfo/xml`,
        depositEnquiry: `${baseUrl}/enquireDeposit/fetchDetails/xml`,
        billValidation: `${baseUrl}/extBillValCntrl/billValidationRequest/xml`,
      },
    };
  })(),
  
  // CAPTCHA: Cloudflare Turnstile (free, privacy-friendly)
  // Get keys from: https://dash.cloudflare.com/turnstile
  captcha: {
    enabled: process.env.CAPTCHA_ENABLED === 'true',
    siteKey: process.env.CAPTCHA_SITE_KEY || '', // Public key for frontend
    secretKey: process.env.CAPTCHA_SECRET_KEY || '', // Secret key for backend verification
  },
  
  // Payment Gateway Mode Configuration
  // ONLINE = Use webhooks (requires public URL/ngrok)
  // OFFLINE = Use manual status check with PG API (no public URL needed)
  pgMode: {
    mode: (process.env.PG_MODE || 'OFFLINE') as 'ONLINE' | 'OFFLINE',
    // Auto-check interval in seconds (for polling mode, 0 = disabled)
    autoCheckInterval: parseInt(process.env.PG_AUTO_CHECK_INTERVAL || '0', 10),
  },
};

