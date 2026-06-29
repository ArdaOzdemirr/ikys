import { PayrollService } from './payroll.service';
import { PayrollCalculator } from './payroll.calculator';
import { ExpenseStatus } from '@prisma/client';

/**
 * "avans" kategorisindeki ödenmiş masraflar bordro üretilirken otomatik
 * olarak net maaştan düşülmeli ve aynı avans iki kez düşülmemeli (bkz.
 * Expense.appliedPayrollId).
 */
describe('PayrollService.generatePayroll - avans entegrasyonu', () => {
  const salaryConfig = {
    grossSalary: 50000,
    agi: 0,
    mealAllowance: 0,
    transportAllowance: 0,
    bes: 0,
  };

  function buildService(unappliedAvans: { id: string; amount: number }[]) {
    let createdPayroll: any;
    let updateManyArgs: any;

    const tx = {
      payroll: {
        create: jest.fn((args: any) => {
          createdPayroll = { id: 'payroll1', ...args.data };
          return createdPayroll;
        }),
      },
      expense: {
        updateMany: jest.fn((args: any) => {
          updateManyArgs = args;
          return { count: args.where.id.in.length };
        }),
      },
    };

    const prisma = {
      salaryConfig: { findUnique: jest.fn().mockResolvedValue(salaryConfig) },
      payroll: {
        findUnique: jest.fn().mockResolvedValue(null), // bu ay için bordro yok
        aggregate: jest.fn().mockResolvedValue({ _sum: { grossSalary: null } }),
      },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      expense: {
        findMany: jest.fn().mockResolvedValue(
          unappliedAvans.map((e) => ({ ...e, status: ExpenseStatus.PAID, appliedPayrollId: null })),
        ),
      },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    const service = new PayrollService(prisma as any, new PayrollCalculator(), {} as any);
    return { service, prisma, tx, getCreatedPayroll: () => createdPayroll, getUpdateManyArgs: () => updateManyArgs };
  }

  it('ödenmiş avans yoksa avansDeduction sıfırdır', async () => {
    const { service, getCreatedPayroll } = buildService([]);
    const baseline = new PayrollCalculator().calculate({ grossSalary: 50000 });

    await service.generatePayroll({ personnelId: 'p1', year: 2026, month: 7 } as any);

    const payroll = getCreatedPayroll();
    expect(+payroll.avansDeduction).toBe(0);
    expect(+payroll.netSalary).toBeCloseTo(baseline.netSalary, 2);
  });

  it('ödenmiş avans varsa toplamı net maaştan düşer', async () => {
    const { service, getCreatedPayroll } = buildService([
      { id: 'exp1', amount: 1000 },
      { id: 'exp2', amount: 500 },
    ]);
    const baseline = new PayrollCalculator().calculate({ grossSalary: 50000 });

    await service.generatePayroll({ personnelId: 'p1', year: 2026, month: 7 } as any);

    const payroll = getCreatedPayroll();
    expect(+payroll.avansDeduction).toBe(1500);
    expect(+payroll.netSalary).toBeCloseTo(baseline.netSalary - 1500, 2);
  });

  it('düşülen avansları bordroya bağlar (aynı avans tekrar düşülemesin diye)', async () => {
    const { service, getUpdateManyArgs } = buildService([{ id: 'exp1', amount: 1000 }]);

    await service.generatePayroll({ personnelId: 'p1', year: 2026, month: 7 } as any);

    const args = getUpdateManyArgs();
    expect(args.where.id.in).toEqual(['exp1']);
    expect(args.data.appliedPayrollId).toBe('payroll1');
  });

  it('sadece PAID ve appliedPayrollId null olan avansları sorgular', async () => {
    const { service, prisma } = buildService([]);

    await service.generatePayroll({ personnelId: 'p1', year: 2026, month: 7 } as any);

    const where = (prisma.expense.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe(ExpenseStatus.PAID);
    expect(where.appliedPayrollId).toBeNull();
    expect(where.category).toEqual({ equals: 'avans', mode: 'insensitive' });
  });
});

describe('PayrollService.payExpense', () => {
  function buildService(expense: any) {
    let updateArgs: any;
    const prisma = {
      expense: {
        findUnique: jest.fn().mockResolvedValue(expense),
        update: jest.fn((args: any) => {
          updateArgs = args;
          return { ...expense, ...args.data };
        }),
      },
    };
    const notifications = { create: jest.fn() };
    const service = new PayrollService(prisma as any, new PayrollCalculator(), notifications as any);
    return { service, getUpdateArgs: () => updateArgs };
  }

  it('ödeyen kişinin id\'sini paidById olarak kaydeder', async () => {
    const { service, getUpdateArgs } = buildService({
      id: 'exp1',
      personnelId: 'p1',
      status: ExpenseStatus.APPROVED,
      amount: 1000,
      currency: 'TRY',
    });

    await service.payExpense('exp1', 'accounting-personnel-1');

    const args = getUpdateArgs();
    expect(args.data.paidById).toBe('accounting-personnel-1');
    expect(args.data.status).toBe(ExpenseStatus.PAID);
  });

  it('onaylanmamış talep ödenmeye çalışılırsa hata fırlatır', async () => {
    const { service } = buildService({
      id: 'exp1',
      personnelId: 'p1',
      status: ExpenseStatus.PENDING,
      amount: 1000,
      currency: 'TRY',
    });

    await expect(service.payExpense('exp1', 'accounting-personnel-1')).rejects.toThrow();
  });
});
