-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "businessName" TEXT,
    "profilePhoto" TEXT,
    "parentId" TEXT,
    "panNumber" TEXT,
    "panVerified" TEXT NOT NULL DEFAULT 'PENDING',
    "aadhaarNumber" TEXT,
    "aadhaarFront" TEXT,
    "aadhaarBack" TEXT,
    "aadhaarVerified" TEXT NOT NULL DEFAULT 'PENDING',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "onboardingToken" TEXT,
    "onboardingTokenExpiry" DATETIME,
    "emailOtp" TEXT,
    "emailOtpExpiry" DATETIME,
    "schemaId" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedLogin" DATETIME,
    "lockedUntil" DATETIME,
    "lockedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME,
    CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "canCreateUsers" BOOLEAN NOT NULL DEFAULT false,
    "canManageWallet" BOOLEAN NOT NULL DEFAULT false,
    "canTransferWallet" BOOLEAN NOT NULL DEFAULT false,
    "canCreateSchema" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT true,
    "canManagePG" BOOLEAN NOT NULL DEFAULT false,
    "canApproveUsers" BOOLEAN NOT NULL DEFAULT false,
    "canViewTransactions" BOOLEAN NOT NULL DEFAULT true,
    "canInitiatePayin" BOOLEAN NOT NULL DEFAULT false,
    "canInitiatePayout" BOOLEAN NOT NULL DEFAULT false,
    "canAssignRates" BOOLEAN NOT NULL DEFAULT false,
    "customPermissions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "holdBalance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentGateway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "merchantId" TEXT,
    "webhookSecret" TEXT,
    "configuration" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportedTypes" TEXT NOT NULL DEFAULT 'PAYIN,PAYOUT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TransactionChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cardNetwork" TEXT,
    "cardType" TEXT,
    "baseCost" REAL NOT NULL DEFAULT 0.02,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "transactionType" TEXT NOT NULL DEFAULT 'PAYIN',
    "pgResponseCodes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionChannel_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PaymentGateway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "applicableRoles" TEXT NOT NULL DEFAULT 'RETAILER',
    "payinRate" REAL NOT NULL DEFAULT 0.02,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schema_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemaPayinRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "payinRate" REAL NOT NULL DEFAULT 0.02,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchemaPayinRate_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchemaPayinRate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TransactionChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchemaPayinRate_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PaymentGateway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPayinRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "payinRate" REAL NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPayinRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPayinRate_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TransactionChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPayinRate_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemaPayoutConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchemaPayoutConfig_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchemaPayoutConfig_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PaymentGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutSlab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaPayoutConfigId" TEXT NOT NULL,
    "minAmount" REAL NOT NULL,
    "maxAmount" REAL,
    "flatCharge" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayoutSlab_schemaPayoutConfigId_fkey" FOREIGN KEY ("schemaPayoutConfigId") REFERENCES "SchemaPayoutConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPayoutRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPayoutRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPayoutRate_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPayoutSlab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userPayoutRateId" TEXT NOT NULL,
    "minAmount" REAL NOT NULL,
    "maxAmount" REAL,
    "flatCharge" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPayoutSlab_userPayoutRateId_fkey" FOREIGN KEY ("userPayoutRateId") REFERENCES "UserPayoutRate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPGAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPGAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPGAssignment_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PaymentGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" REAL NOT NULL,
    "pgCharges" REAL NOT NULL DEFAULT 0,
    "platformCommission" REAL NOT NULL DEFAULT 0,
    "netAmount" REAL NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "pgTransactionId" TEXT,
    "pgResponse" TEXT,
    "channelId" TEXT,
    "rawPaymentMethod" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "beneficiaryId" TEXT,
    "beneficiaryName" TEXT,
    "beneficiaryAccount" TEXT,
    "beneficiaryIfsc" TEXT,
    "beneficiaryMode" TEXT,
    "locationLatitude" REAL,
    "locationLongitude" REAL,
    "locationAccuracyM" REAL,
    "locationSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Transaction_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PaymentGateway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TransactionChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "rate" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "creditedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommissionTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'SAVINGS',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Beneficiary_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PayoutProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "dataType" TEXT NOT NULL DEFAULT 'STRING',
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "targetRoles" TEXT,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CachedBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "billerId" TEXT NOT NULL,
    "billerName" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "cardLast4" TEXT,
    "billNumber" TEXT NOT NULL,
    "billDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "rawResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CachedBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_onboardingToken_key" ON "User"("onboardingToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_parentId_idx" ON "User"("parentId");

-- CreateIndex
CREATE INDEX "User_schemaId_idx" ON "User"("schemaId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_parentId_role_idx" ON "User"("parentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_key" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_type_idx" ON "WalletTransaction"("walletId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGateway_name_key" ON "PaymentGateway"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGateway_code_key" ON "PaymentGateway"("code");

-- CreateIndex
CREATE INDEX "TransactionChannel_pgId_idx" ON "TransactionChannel"("pgId");

-- CreateIndex
CREATE INDEX "TransactionChannel_category_idx" ON "TransactionChannel"("category");

-- CreateIndex
CREATE INDEX "TransactionChannel_cardNetwork_idx" ON "TransactionChannel"("cardNetwork");

-- CreateIndex
CREATE INDEX "TransactionChannel_transactionType_idx" ON "TransactionChannel"("transactionType");

-- CreateIndex
CREATE INDEX "TransactionChannel_isDefault_idx" ON "TransactionChannel"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionChannel_pgId_code_key" ON "TransactionChannel"("pgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Schema_code_key" ON "Schema"("code");

-- CreateIndex
CREATE INDEX "Schema_isActive_idx" ON "Schema"("isActive");

-- CreateIndex
CREATE INDEX "Schema_createdById_idx" ON "Schema"("createdById");

-- CreateIndex
CREATE INDEX "SchemaPayinRate_schemaId_idx" ON "SchemaPayinRate"("schemaId");

-- CreateIndex
CREATE INDEX "SchemaPayinRate_channelId_idx" ON "SchemaPayinRate"("channelId");

-- CreateIndex
CREATE INDEX "SchemaPayinRate_pgId_idx" ON "SchemaPayinRate"("pgId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaPayinRate_schemaId_channelId_key" ON "SchemaPayinRate"("schemaId", "channelId");

-- CreateIndex
CREATE INDEX "UserPayinRate_userId_idx" ON "UserPayinRate"("userId");

-- CreateIndex
CREATE INDEX "UserPayinRate_channelId_idx" ON "UserPayinRate"("channelId");

-- CreateIndex
CREATE INDEX "UserPayinRate_assignedById_idx" ON "UserPayinRate"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "UserPayinRate_userId_channelId_key" ON "UserPayinRate"("userId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaPayoutConfig_schemaId_key" ON "SchemaPayoutConfig"("schemaId");

-- CreateIndex
CREATE INDEX "PayoutSlab_schemaPayoutConfigId_idx" ON "PayoutSlab"("schemaPayoutConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPayoutRate_userId_key" ON "UserPayoutRate"("userId");

-- CreateIndex
CREATE INDEX "UserPayoutSlab_userPayoutRateId_idx" ON "UserPayoutSlab"("userPayoutRateId");

-- CreateIndex
CREATE INDEX "UserPGAssignment_pgId_idx" ON "UserPGAssignment"("pgId");

-- CreateIndex
CREATE INDEX "UserPGAssignment_userId_idx" ON "UserPGAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPGAssignment_userId_pgId_key" ON "UserPGAssignment"("userId", "pgId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionId_key" ON "Transaction"("transactionId");

-- CreateIndex
CREATE INDEX "Transaction_initiatorId_idx" ON "Transaction"("initiatorId");

-- CreateIndex
CREATE INDEX "Transaction_pgId_idx" ON "Transaction"("pgId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_initiatorId_status_idx" ON "Transaction"("initiatorId", "status");

-- CreateIndex
CREATE INDEX "Transaction_initiatorId_type_idx" ON "Transaction"("initiatorId", "type");

-- CreateIndex
CREATE INDEX "Transaction_initiatorId_createdAt_idx" ON "Transaction"("initiatorId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_pgId_status_idx" ON "Transaction"("pgId", "status");

-- CreateIndex
CREATE INDEX "Transaction_pgId_createdAt_idx" ON "Transaction"("pgId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_channelId_idx" ON "Transaction"("channelId");

-- CreateIndex
CREATE INDEX "CommissionTransaction_transactionId_idx" ON "CommissionTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "CommissionTransaction_userId_idx" ON "CommissionTransaction"("userId");

-- CreateIndex
CREATE INDEX "CommissionTransaction_userId_createdAt_idx" ON "CommissionTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutProfile_userId_idx" ON "PayoutProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutProfile_userId_mobile_key" ON "PayoutProfile"("userId", "mobile");

-- CreateIndex
CREATE INDEX "Beneficiary_userId_idx" ON "Beneficiary"("userId");

-- CreateIndex
CREATE INDEX "Beneficiary_profileId_idx" ON "Beneficiary"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "CachedBill_userId_idx" ON "CachedBill"("userId");

-- CreateIndex
CREATE INDEX "CachedBill_mobileNumber_idx" ON "CachedBill"("mobileNumber");

-- CreateIndex
CREATE INDEX "CachedBill_status_idx" ON "CachedBill"("status");

-- CreateIndex
CREATE INDEX "CachedBill_expiresAt_idx" ON "CachedBill"("expiresAt");
