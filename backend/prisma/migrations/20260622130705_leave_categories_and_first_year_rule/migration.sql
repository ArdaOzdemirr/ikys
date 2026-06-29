-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "paymentType" "PaymentType",
ADD COLUMN     "requiresPaymentDecision" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "type" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LeaveCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "affectsAnnualBalance" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveCategoryAccess" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveCategoryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveCategory_code_key" ON "LeaveCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveCategoryAccess_categoryId_personnelId_key" ON "LeaveCategoryAccess"("categoryId", "personnelId");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LeaveCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCategory" ADD CONSTRAINT "LeaveCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCategoryAccess" ADD CONSTRAINT "LeaveCategoryAccess_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LeaveCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCategoryAccess" ADD CONSTRAINT "LeaveCategoryAccess_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
