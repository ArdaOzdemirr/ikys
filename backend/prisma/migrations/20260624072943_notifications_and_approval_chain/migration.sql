-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAVE_APPROVAL_PENDING', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'MESSAGE');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "currentStepOrder" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LeaveApprovalStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_approverId_status_idx" ON "LeaveApprovalStep"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalStep_requestId_stepOrder_key" ON "LeaveApprovalStep"("requestId", "stepOrder");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
