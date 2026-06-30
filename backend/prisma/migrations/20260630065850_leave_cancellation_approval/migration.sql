-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'CANCEL_REQUESTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_REJECTED';

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "cancelApproverId" TEXT,
ADD COLUMN     "cancelRejectionReason" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_cancelApproverId_fkey" FOREIGN KEY ("cancelApproverId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
