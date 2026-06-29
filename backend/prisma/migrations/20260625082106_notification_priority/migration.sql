-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
