import { LeaveService } from './leave.service';
import { LeaveType, LeaveStatus } from '@prisma/client';

/**
 * "İlk yıl izin kuralı" (bkz. backend/STEPS.md):
 *  - Kıdemi 1 yıldan az olan personel yıllık izin isterse ödeme tipi
 *    (ücretli/ücretsiz) kararı onaylayana bırakılır. Ücretsiz onaylanırsa
 *    bakiyeye dokunulmaz; ÜCRETLİ onaylanırsa henüz hak edilmemiş bakiyeden
 *    düşülür (borca düşer, ileride birikecek hakedişten karşılanır) — bu
 *    yüzden deductFromYear yine de set edilir.
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

  function buildService(personnel: ReturnType<typeof makePersonnel>, usedDays = 0) {
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
        // annualLeaveSummary(): kümülatif hakediş - tüm yılların usedDays toplamı
        findMany: jest.fn().mockResolvedValue(usedDays > 0 ? [{ usedDays }] : []),
      },
      holiday: {
        findMany: jest.fn().mockResolvedValue([]), // calculateBusinessDays: resmi tatil yok
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

  it('kıdemi 1 yıldan az personel için ödeme kararı onaylayana bırakılır (ücretliyse borca düşebilir)', async () => {
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
    expect(captured[0].deductFromYear).toBe(2026);
  });

  it('kıdemi 1+ yıl ve bakiyesi yeterli personel için o yılın bakiyesinden düşülür', async () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    // 2 yıl kıdem = 28 gün kümülatif hak; 10'u kullanılmış, 18 gün kalmış (yeterli).
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
    // 2 yıl kıdem = 28 gün kümülatif hak; 27'si kullanılmış, sadece 1 gün kalmış (yetersiz).
    const { service, prisma } = buildService(makePersonnel(twoYearsAgo), 27);

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

/**
 * "İzin başladıktan sonra silinemesin, onaylı izin silinirken üst onayı
 * istensin" kuralı: onaylı izinler artık doğrudan silinmiyor/iptal
 * edilmiyor; amirin onayladığı bir iptal talebi akışından geçiyor.
 */
describe('LeaveService - izin iptal onay akışı', () => {
  function buildService(leaveRequest: any) {
    let updateArgs: any;
    let balanceUpdated = false;
    const prisma = {
      personnel: {
        findFirst: jest.fn().mockResolvedValue(null), // fallbackApprover/finalHrApprover: İK/Admin yok
        findUnique: jest.fn().mockResolvedValue({ user: { role: 'MANAGER' } }), // decideCancellation: onaylayanın rolü
      },
      leaveRequest: {
        findUnique: jest.fn().mockResolvedValue(leaveRequest),
        update: jest.fn((args: any) => {
          updateArgs = args;
          return { ...leaveRequest, ...args.data };
        }),
      },
      leaveApprovalStep: { updateMany: jest.fn() },
      leaveBalance: {
        update: jest.fn(() => {
          balanceUpdated = true;
          return Promise.resolve({});
        }),
      },
      $transaction: jest.fn((cb: any) =>
        cb({
          leaveRequest: prisma.leaveRequest,
          leaveBalance: prisma.leaveBalance,
        }),
      ),
    } as any;
    const notifications = { create: jest.fn() };
    const service = new LeaveService(prisma as any, notifications as any);
    return { service, prisma, notifications, getUpdateArgs: () => updateArgs, wasBalanceRestored: () => balanceUpdated };
  }

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('cancel(): yalnızca PENDING talepler doğrudan iptal edilebilir', async () => {
    const { service } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.APPROVED,
    });
    await expect(service.cancel('req1', 'p1')).rejects.toThrow();
  });

  it('remove(): onaylı (APPROVED) izin doğrudan silinemez', async () => {
    const { service } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.APPROVED,
    });
    await expect(service.remove('req1', 'p1', 'EMPLOYEE')).rejects.toThrow();
  });

  it('requestCancellation(): başlamış izin için iptal talebi oluşturulamaz', async () => {
    const { service } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.APPROVED,
      startDate: past, personnel: { firstName: 'A', lastName: 'B', managerId: 'm1' },
    });
    await expect(service.requestCancellation('req1', 'p1')).rejects.toThrow();
  });

  it('requestCancellation(): henüz başlamamış onaylı izin için amire iptal talebi gider', async () => {
    const { service, getUpdateArgs, notifications } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.APPROVED,
      startDate: future, personnel: { firstName: 'A', lastName: 'B', managerId: 'm1' },
    });

    await service.requestCancellation('req1', 'p1');

    expect(getUpdateArgs().data.status).toBe(LeaveStatus.CANCEL_REQUESTED);
    expect(getUpdateArgs().data.cancelApproverId).toBe('m1');
    expect(notifications.create).toHaveBeenCalled();
  });

  it('decideCancellation(): yetkisiz biri onaylayamaz', async () => {
    const { service } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.CANCEL_REQUESTED,
      cancelApproverId: 'm1', startDate: future,
    });
    await expect(
      service.decideCancellation('req1', 'baska-biri', true, 'MANAGER'),
    ).rejects.toThrow();
  });

  it('decideCancellation(): onaylanırsa izin CANCELLED olur ve bakiye iade edilir', async () => {
    const { service, getUpdateArgs, wasBalanceRestored } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.CANCEL_REQUESTED,
      cancelApproverId: 'm1', startDate: future, totalDays: 3, deductFromYear: 2026,
      requiresPaymentDecision: false, type: LeaveType.ANNUAL, category: null,
    });

    await service.decideCancellation('req1', 'm1', true, 'MANAGER');

    expect(getUpdateArgs().data.status).toBe(LeaveStatus.CANCELLED);
    expect(wasBalanceRestored()).toBe(true);
  });

  it('decideCancellation(): reddedilirse izin tekrar APPROVED olur', async () => {
    const { service, getUpdateArgs, notifications } = buildService({
      id: 'req1', personnelId: 'p1', status: LeaveStatus.CANCEL_REQUESTED,
      cancelApproverId: 'm1', startDate: future,
    });

    await service.decideCancellation('req1', 'm1', false, 'MANAGER', 'Ekip yoğun');

    expect(getUpdateArgs().data.status).toBe(LeaveStatus.APPROVED);
    expect(notifications.create).toHaveBeenCalled();
  });
});
