-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "appliedPayrollId" TEXT;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "avansDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_appliedPayrollId_fkey" FOREIGN KEY ("appliedPayrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
