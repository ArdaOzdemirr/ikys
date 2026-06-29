import { LeaveService } from './leave.service';
import { LeaveType } from '@prisma/client';

/**
 * "İlk yıl izin kuralı" (bkz. backend/STEPS.md):
 *  - Kıdemi 1 yıldan az olan personel yıllık izin isterse bakiye düşülmez,
 *    ödeme tipi (ücretli/ücretsiz) kararı onaylayana bırakılır.
 *  - Kıdemi 1+ yıl olan personel için bakiye yeterliyse o yıldan düşülür;
 *    yetersizse talep engellenmez, gelecek yılın bakiyesinden düşülmek üzere
 *    ödeme tipi kararı onaylayana bırakılır.
 */
describe('LeaveService - ilk yıl izin kuralı', () => {
  const makePersonnel = (hireDate: Date) => ({
    id: 'p1',
    firstName: 'Test',
    lastName: 'Kullanıcı',
    hireDate,
    managerId: null,
    status: 'ACTIVE',
  });

  function buildService(personnel: ReturnType<typeof makePersonnel>, remainingDays = 0) {
    const prisma = {
      personnel: {
        findUnique: jest.fn().mockResolvedValue(personnel),
        findFirst: jest.fn().mockResolvedValue(null), // fallbackApprover: İK/Admin yok
      },
      leaveRequest: {
        findFirst: jest.fn().mockResolvedValue(null), // çakışma yok
      },
      leaveCategory: {
        findUnique: jest.fn().mockResolvedValue(null), // eski enum fallback'ine düşsün
      },
      leaveBalance: {
        findUnique: jest.fn().mockResolvedValue({ remainingDays }),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          leaveRequest: { create: jest.fn().mockResolvedValue({ id: 'req1' }) },
          leaveApprovalStep: { createMany: jest.fn() },
        }),
      ),
    };
    const notifications = { create: jest.fn() };

    return { prisma, notifications, service: new LeaveService(prisma as any, notifications as any) };
  }

  it('kıdemi 1 yıldan az personel için bakiye düşülmez, ödeme kararı onaylayana bırakılır', async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const { service, prisma } = buildService(makePersonnel(oneMonthAgo));

    const captured: any[] = [];
    prisma.$transaction = jest.fn(async (cb: any) => {
      const tx = {
        leaveRequest: {
          create: jest.fn((args: any) => {
            captured.push(args.data);
            return { id: 'req1' };
          }),
        },
        leaveApprovalStep: { createMany: jest.fn() },
      };
      return cb(tx);
    });

    await service.createRequest('p1', {
      type: LeaveType.ANNUAL,
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      reason: 'Tatil',
    } as any);

    expect(captured[0].requiresPaymentDecision).toBe(true);
    expect(captured[0].deductFromYear).toBeNull();
  });

  it('kıdemi 1+ yıl ve bakiyesi yeterli personel için o yılın bakiyesinden düşülür', async () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const { service, prisma } = buildService(makePersonnel(twoYearsAgo), 10);

    const captured: any[] = [];
    prisma.$transaction = jest.fn(async (cb: any) => {
      const tx = {
        leaveRequest: {
          create: jest.fn((args: any) => {
            captured.push(args.data);
            return { id: 'req1' };
          }),
        },
        leaveApprovalStep: { createMany: jest.fn() },
      };
      return cb(tx);
    });

    await service.createRequest('p1', {
      type: LeaveType.ANNUAL,
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      reason: 'Tatil',
    } as any);

    expect(captured[0].requiresPaymentDecision).toBe(false);
    expect(captured[0].deductFromYear).toBe(2026);
  });

  it('kıdemi 1+ yıl ama bakiyesi yetersiz personel için talep engellenmez, gelecek yıldan düşülmek üzere işaretlenir', async () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const { service, prisma } = buildService(makePersonnel(twoYearsAgo), 1);

    const captured: any[] = [];
    prisma.$transaction = jest.fn(async (cb: any) => {
      const tx = {
        leaveRequest: {
          create: jest.fn((args: any) => {
            captured.push(args.data);
            return { id: 'req1' };
          }),
        },
        leaveApprovalStep: { createMany: jest.fn() },
      };
      return cb(tx);
    });

    await service.createRequest('p1', {
      type: LeaveType.ANNUAL,
      startDate: '2026-08-01',
      endDate: '2026-08-05', // 4 gün, bakiye sadece 1
      reason: 'Tatil',
    } as any);

    expect(captured[0].requiresPaymentDecision).toBe(true);
    expect(captured[0].deductFromYear).toBe(2027);
  });
});
