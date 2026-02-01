export type UserRole = 'ADMIN' | 'WHITE_LABEL' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';
export type UserStatus = 'PENDING_ONBOARDING' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED' | 'REJECTED';
export type TransactionType = 'PAYIN' | 'PAYOUT' | 'CC_PAYMENT';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
export type WalletTransactionType = 'CREDIT' | 'DEBIT' | 'COMMISSION' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'REFUND' | 'PAYOUT_HOLD' | 'PAYOUT_REFUND';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: JWTPayload;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserDTO {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  businessName?: string;
  schemaId?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  businessName?: string;
  status?: UserStatus;
  schemaId?: string;
}

export interface UpdatePermissionsDTO {
  canCreateUsers?: boolean;
  canManageWallet?: boolean;
  canTransferWallet?: boolean;
  canCreateSchema?: boolean;
  canViewReports?: boolean;
  canManagePG?: boolean;
  canApproveUsers?: boolean;
  canViewTransactions?: boolean;
  canInitiatePayin?: boolean;
  canInitiatePayout?: boolean;
  customPermissions?: Record<string, boolean>;
}

export interface CreateTransactionDTO {
  type: TransactionType;
  amount: number;
  pgId: string;
  cardLast4?: string;
  cardNetwork?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  // Beneficiary details for payout
  beneficiaryId?: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  beneficiaryIfsc?: string;
  description?: string;
  metadata?: any;
}

export interface CreateSchemaDTO {
  name: string;
  code: string;
  description?: string;
  applicableRoles: UserRole[];
  isDefault?: boolean;
}

export interface SchemaPGRateDTO {
  pgId: string;
  payinRate: number;
  payoutRate: number;
}

export interface CreatePGDTO {
  name: string;
  code: string;
  description?: string;
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  webhookSecret?: string;
  configuration?: Record<string, any>;
  baseRate: number;
  minAmount?: number;
  maxAmount?: number;
  supportedTypes?: TransactionType[];
}

export interface WalletTransferDTO {
  toUserId: string;
  amount: number;
  description?: string;
}

export interface OnboardingDTO {
  firstName: string;
  lastName: string;
  phone: string;
  businessName?: string;
  panNumber: string;
  aadhaarNumber: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 0,
  WHITE_LABEL: 1,
  MASTER_DISTRIBUTOR: 2,
  DISTRIBUTOR: 3,
  RETAILER: 4,
};

export const ALLOWED_CHILD_ROLES: Record<UserRole, UserRole[]> = {
  ADMIN: ['WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
  WHITE_LABEL: ['MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
  MASTER_DISTRIBUTOR: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
  RETAILER: [],
};

