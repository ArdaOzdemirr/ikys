-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidById" TEXT;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
