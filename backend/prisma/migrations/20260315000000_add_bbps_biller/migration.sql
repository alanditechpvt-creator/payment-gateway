-- CreateTable
CREATE TABLE "BbpsBiller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billerId" TEXT NOT NULL,
    "billerName" TEXT NOT NULL,
    "billerAliasName" TEXT,
    "billerCategory" TEXT,
    "isTopBiller" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BbpsBiller_billerId_key" ON "BbpsBiller"("billerId");

-- CreateIndex
CREATE INDEX "BbpsBiller_isTopBiller_idx" ON "BbpsBiller"("isTopBiller");

-- CreateIndex
CREATE INDEX "BbpsBiller_billerCategory_idx" ON "BbpsBiller"("billerCategory");
