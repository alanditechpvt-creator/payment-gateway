/**
 * Application Constants
 * 
 * Centralized constants to avoid magic strings/numbers
 */

// ==================== ROLES & HIERARCHY ====================

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  WHITE_LABEL: 'WHITE_LABEL',
  MASTER_DISTRIBUTOR: 'MASTER_DISTRIBUTOR',
  DISTRIBUTOR: 'DISTRIBUTOR',
  RETAILER: 'RETAILER',
} as const;

export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_HIERARCHY: Record<UserRoleType, number> = {
  [USER_ROLES.ADMIN]: 0,
  [USER_ROLES.WHITE_LABEL]: 1,
  [USER_ROLES.MASTER_DISTRIBUTOR]: 2,
  [USER_ROLES.DISTRIBUTOR]: 3,
  [USER_ROLES.RETAILER]: 4,
};

export const ALLOWED_CHILD_ROLES: Record<UserRoleType, UserRoleType[]> = {
  [USER_ROLES.ADMIN]: [USER_ROLES.WHITE_LABEL, USER_ROLES.MASTER_DISTRIBUTOR, USER_ROLES.DISTRIBUTOR, USER_ROLES.RETAILER],
  [USER_ROLES.WHITE_LABEL]: [USER_ROLES.MASTER_DISTRIBUTOR, USER_ROLES.DISTRIBUTOR, USER_ROLES.RETAILER],
  [USER_ROLES.MASTER_DISTRIBUTOR]: [USER_ROLES.DISTRIBUTOR, USER_ROLES.RETAILER],
  [USER_ROLES.DISTRIBUTOR]: [USER_ROLES.RETAILER],
  [USER_ROLES.RETAILER]: [],
};

// ==================== USER STATUS ====================

export const USER_STATUS = {
  PENDING_ONBOARDING: 'PENDING_ONBOARDING',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type UserStatusType = typeof USER_STATUS[keyof typeof USER_STATUS];

// ==================== TRANSACTION ====================

export const TRANSACTION_TYPE = {
  PAYIN: 'PAYIN',
  PAYOUT: 'PAYOUT',
} as const;

export type TransactionTypeValue = typeof TRANSACTION_TYPE[keyof typeof TRANSACTION_TYPE];

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type TransactionStatusValue = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

// ==================== WALLET ====================

export const WALLET_TRANSACTION_TYPE = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  HOLD: 'HOLD',
  RELEASE: 'RELEASE',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  COMMISSION: 'COMMISSION',
} as const;

export type WalletTransactionTypeValue = typeof WALLET_TRANSACTION_TYPE[keyof typeof WALLET_TRANSACTION_TYPE];

// ==================== KYC ====================

export const KYC_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type KycStatusType = typeof KYC_STATUS[keyof typeof KYC_STATUS];

// ==================== CARD NETWORKS ====================

export const CARD_NETWORKS = {
  VISA: 'VISA',
  MASTER: 'MASTER',
  RUPAY: 'RUPAY',
  AMEX: 'AMEX',
  UPI: 'UPI',
  NETBANKING: 'NETBANKING',
} as const;

export type CardNetworkType = typeof CARD_NETWORKS[keyof typeof CARD_NETWORKS];

export const CARD_CATEGORIES = {
  NORMAL: 'NORMAL',
  CORPORATE: 'CORPORATE',
  PREMIUM: 'PREMIUM',
  PLATINUM: 'PLATINUM',
  BUSINESS: 'BUSINESS',
} as const;

export type CardCategoryType = typeof CARD_CATEGORIES[keyof typeof CARD_CATEGORIES];

// ==================== PAYOUT ====================

export const PAYOUT_CHARGE_TYPE = {
  PERCENTAGE: 'PERCENTAGE',
  SLAB: 'SLAB',
} as const;

export type PayoutChargeTypeValue = typeof PAYOUT_CHARGE_TYPE[keyof typeof PAYOUT_CHARGE_TYPE];

export const ACCOUNT_TYPE = {
  SAVINGS: 'SAVINGS',
  CURRENT: 'CURRENT',
} as const;

export type AccountTypeValue = typeof ACCOUNT_TYPE[keyof typeof ACCOUNT_TYPE];

// ==================== PAGINATION ====================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ==================== RATE LIMITS ====================

export const RATE_LIMITS = {
  API: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
  },
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 10,
  },
  TRANSACTION: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 10,
  },
} as const;

// ==================== TOKEN EXPIRY ====================

export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '24h',
  REFRESH_TOKEN: '30d',
  EMAIL_OTP: 10 * 60 * 1000, // 10 minutes
  ONBOARDING_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// ==================== FILE UPLOAD ====================

export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.pdf'],
} as const;

// ==================== CACHE ====================

export const CACHE = {
  STATIC_FILES: 30 * 24 * 60 * 60, // 30 days in seconds
  API_RESPONSE: 60, // 1 minute
  TOKEN: 2 * 60 * 60, // 2 hours
} as const;

// ==================== ERROR CODES ====================

export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  
  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
  USER_PERMISSION_DENIED: 'USER_PERMISSION_DENIED',
  
  // Transaction
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_ALREADY_PROCESSED: 'TRANSACTION_ALREADY_PROCESSED',
  TRANSACTION_AMOUNT_INVALID: 'TRANSACTION_AMOUNT_INVALID',
  
  // Wallet
  WALLET_INSUFFICIENT_BALANCE: 'WALLET_INSUFFICIENT_BALANCE',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  
  // Payment Gateway
  PG_NOT_FOUND: 'PG_NOT_FOUND',
  PG_NOT_ACTIVE: 'PG_NOT_ACTIVE',
  PG_ERROR: 'PG_ERROR',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCodeType = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ==================== SUCCESS MESSAGES ====================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  USER_APPROVED: 'User approved successfully',
  
  TRANSACTION_CREATED: 'Transaction initiated successfully',
  TRANSACTION_SUCCESS: 'Transaction completed successfully',
  TRANSACTION_FAILED: 'Transaction failed',
  
  WALLET_CREDITED: 'Wallet credited successfully',
  WALLET_DEBITED: 'Wallet debited successfully',
  WALLET_TRANSFER_SUCCESS: 'Transfer completed successfully',
  
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_CHANGED: 'Password changed successfully',
  
  RATE_ASSIGNED: 'Rate assigned successfully',
  SCHEMA_CREATED: 'Schema created successfully',
  PG_CREATED: 'Payment gateway created successfully',
} as const;

