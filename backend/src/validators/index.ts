/**
 * Zod Validation Schemas
 * 
 * Centralized validation for all API inputs
 * Import and use with validateRequest middleware
 */

import { z } from 'zod';

// ==================== COMMON SCHEMAS ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const uuidSchema = z.string().uuid('Invalid ID format');

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, { message: 'Start date must be before end date' });

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ==================== USER SCHEMAS ====================

export const userRoleSchema = z.enum([
  'ADMIN',
  'WHITE_LABEL', 
  'MASTER_DISTRIBUTOR',
  'DISTRIBUTOR',
  'RETAILER',
]);

export const userStatusSchema = z.enum([
  'PENDING_ONBOARDING',
  'PENDING_APPROVAL',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: userRoleSchema,
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  businessName: z.string().min(2).max(100).optional(),
  schemaId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  businessName: z.string().min(2).max(100).optional(),
  status: userStatusSchema.optional(),
  schemaId: z.string().uuid().optional(),
});

export const updatePermissionsSchema = z.object({
  canCreateUsers: z.boolean().optional(),
  canManageWallet: z.boolean().optional(),
  canTransferWallet: z.boolean().optional(),
  canCreateSchema: z.boolean().optional(),
  canViewReports: z.boolean().optional(),
  canManagePG: z.boolean().optional(),
  canApproveUsers: z.boolean().optional(),
  canViewTransactions: z.boolean().optional(),
  canInitiatePayin: z.boolean().optional(),
  canInitiatePayout: z.boolean().optional(),
  canAssignRates: z.boolean().optional(),
});

export const onboardingSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  businessName: z.string().min(2).max(100).optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  emailOtp: z.string().length(6, 'OTP must be 6 digits'),
});

// ==================== TRANSACTION SCHEMAS ====================

export const transactionTypeSchema = z.enum(['PAYIN', 'PAYOUT']);

export const transactionStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']);

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: z.coerce.number()
    .positive('Amount must be positive')
    .min(10, 'Minimum amount is ₹10')
    .max(500000, 'Maximum amount is ₹5,00,000'),
  pgId: z.string().uuid('Invalid payment gateway ID'),
  customerName: z.string().min(2).max(100).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  // Payout specific
  beneficiaryId: z.string().uuid().optional(),
  beneficiaryName: z.string().min(2).max(100).optional(),
  beneficiaryAccount: z.string().regex(/^\d{9,18}$/, 'Invalid account number').optional(),
  beneficiaryIfsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').optional(),
}).refine(data => {
  if (data.type === 'PAYOUT') {
    return data.beneficiaryId || (data.beneficiaryName && data.beneficiaryAccount && data.beneficiaryIfsc);
  }
  return true;
}, { message: 'Beneficiary details required for payout' });

export const updateTransactionStatusSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED']),
});

export const transactionQuerySchema = paginationSchema.extend({
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  pgId: z.string().uuid().optional(),
  search: z.string().optional(),
}).merge(dateRangeSchema);

// ==================== WALLET SCHEMAS ====================

export const walletTransferSchema = z.object({
  toUserId: z.string().uuid('Invalid user ID'),
  amount: z.coerce.number()
    .positive('Amount must be positive')
    .min(1, 'Minimum transfer is ₹1'),
  description: z.string().max(200).optional(),
});

export const walletAddDeductSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  amount: z.coerce.number().positive('Amount must be positive'),
  description: z.string().max(200).optional(),
});

// ==================== BENEFICIARY SCHEMAS ====================

export const createBeneficiarySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  accountNumber: z.string().regex(/^\d{9,18}$/, 'Account number must be 9-18 digits'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format'),
  bankName: z.string().min(2).max(100).optional(),
  branchName: z.string().max(100).optional(),
  accountType: z.enum(['SAVINGS', 'CURRENT']).default('SAVINGS'),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional(),
});

export const updateBeneficiarySchema = createBeneficiarySchema.partial();

// ==================== SCHEMA (PLAN) SCHEMAS ====================

export const createSchemaSchema = z.object({
  name: z.string().min(2).max(50),
  code: z.string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  description: z.string().max(200).optional(),
  applicableRoles: z.array(userRoleSchema).min(1, 'At least one role required'),
  isDefault: z.boolean().default(false),
});

export const updateSchemaSchema = createSchemaSchema.partial();

export const schemaPGRateSchema = z.object({
  pgId: z.string().uuid(),
  payinRate: z.coerce.number().min(0).max(1, 'Rate must be between 0 and 1 (0-100%)'),
  payoutChargeType: z.enum(['PERCENTAGE', 'SLAB']).default('SLAB'),
  payoutRate: z.coerce.number().min(0).max(1).optional(),
  payoutSlabs: z.array(z.object({
    minAmount: z.coerce.number().min(0),
    maxAmount: z.coerce.number().nullable().optional(),
    flatCharge: z.coerce.number().min(0),
  })).optional(),
});

// ==================== PAYMENT GATEWAY SCHEMAS ====================

export const createPGSchema = z.object({
  name: z.string().min(2).max(50),
  code: z.string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric'),
  description: z.string().max(200).optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  merchantId: z.string().optional(),
  webhookSecret: z.string().optional(),
  baseRate: z.coerce.number().min(0).max(1, 'Rate must be between 0 and 1'),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  supportedTypes: z.string().regex(/^(PAYIN|PAYOUT)(,(PAYIN|PAYOUT))?$/).default('PAYIN,PAYOUT'),
  isActive: z.boolean().default(true),
  isAggregator: z.boolean().default(false),
});

export const updatePGSchema = createPGSchema.partial();

// ==================== CARD TYPE SCHEMAS ====================

export const createCardTypeSchema = z.object({
  pgId: z.string().uuid(),
  code: z.string()
    .min(5)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Code must be lowercase with underscores/hyphens'),
  name: z.string().min(2).max(100),
  description: z.string().max(200).optional(),
  internalPG: z.string().max(50).optional(),
  cardNetwork: z.enum(['VISA', 'MASTER', 'RUPAY', 'AMEX', 'UPI', 'NETBANKING']).optional(),
  cardCategory: z.enum(['NORMAL', 'CORPORATE', 'PREMIUM', 'PLATINUM', 'BUSINESS']).optional(),
  baseRate: z.coerce.number().min(0).max(1),
});

export const updateCardTypeSchema = createCardTypeSchema.partial().omit({ pgId: true, code: true });

// ==================== RATE ASSIGNMENT SCHEMAS ====================

export const assignRateSchema = z.object({
  targetUserId: z.string().uuid(),
  pgId: z.string().uuid(),
  payinRate: z.coerce.number().min(0).max(1),
  payoutRate: z.coerce.number().min(0).max(1).optional(),
});

export const assignCardTypeRateSchema = z.object({
  payinRate: z.coerce.number().min(0).max(1),
});

// ==================== EXPORT ALL SCHEMAS ====================

export const schemas = {
  // Auth
  login: loginSchema,
  register: registerSchema,
  changePassword: changePasswordSchema,
  refreshToken: refreshTokenSchema,
  
  // User
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  updatePermissions: updatePermissionsSchema,
  onboarding: onboardingSchema,
  
  // Transaction
  createTransaction: createTransactionSchema,
  updateTransactionStatus: updateTransactionStatusSchema,
  transactionQuery: transactionQuerySchema,
  
  // Wallet
  walletTransfer: walletTransferSchema,
  walletAddDeduct: walletAddDeductSchema,
  
  // Beneficiary
  createBeneficiary: createBeneficiarySchema,
  updateBeneficiary: updateBeneficiarySchema,
  
  // Schema
  createSchema: createSchemaSchema,
  updateSchema: updateSchemaSchema,
  schemaPGRate: schemaPGRateSchema,
  
  // Payment Gateway
  createPG: createPGSchema,
  updatePG: updatePGSchema,
  
  // Card Type
  createCardType: createCardTypeSchema,
  updateCardType: updateCardTypeSchema,
  
  // Rate
  assignRate: assignRateSchema,
  assignCardTypeRate: assignCardTypeRateSchema,
  
  // Common
  pagination: paginationSchema,
  uuid: uuidSchema,
  dateRange: dateRangeSchema,
};

