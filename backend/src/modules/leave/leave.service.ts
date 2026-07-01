import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  ApprovalStepStatus,
  LeaveStatus,
  LeaveType,
  NotificationType,
  Role,
} from '@prisma/client';
import dayjs from 'dayjs';
import { CreateLeaveRequestDto, ApproveLeaveDto } from './leave.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Belge: "Personel talep eder -> Yöneticiye bildirim gider -> Yönetici onaylar/reddet -> Bakiye güncellenir"
   *
   * Kurallar:
   *  - Türü dinamik kategori (LeaveCategory) belirler; eski enum (type) da kabul edilir.
   *  - Kıdemi 1 yıldan az personel yıllık izin isterse bakiye düşülmez; ücretli/ücretsiz
   *    kararını onaylayan kişi verir (requiresPaymentDecision = true).
   *  - Talep, organizasyon şemasındaki amir zinciri boyunca SIRAYLA onaya çıkar.
   *    Her amir kendi adımında onaylayınca bir üst amire bildirim gider; en üst amir
   *    onaylayınca çalışana "onaylandı" bildirimi düşer. Herhangi biri reddederse zincir
   *    durur ve çalışana "reddedildi" bildirimi gider.
   */
  async createRequest(personnelId: string, dto: CreateLeaveRequestDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('Bitiş tarihi başlangıçtan önce olamaz');
    }
    const today = dayjs().startOf('day');
    if (dayjs(start).isBefore(today)) {
      throw new BadRequestException('Geçmiş bir tarih için izin talebi oluşturulamaz');
    }

    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
    });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');

    // İş günü hesabı (resmi tatiller hariç)
    const totalDays = await this.calculateBusinessDays(start, end);
    if (totalDays <= 0) {
      throw new BadRequestException('Seçilen aralıkta iş günü yok');
    }

    // Belge: "Çakışma Kontrolü"
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        personnelId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
      },
    });
    if (overlap) {
      throw new BadRequestException('Bu tarihlerde mevcut bir izin talebiniz var');
    }

    // Kategori çöz (categoryId -> type fallback)
    const cat = await this.resolveCategory(dto);

    const seniorityYears =
      (Date.now() - personnel.hireDate.getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);

    let requiresPaymentDecision = false;
    let deductFromYear: number | null = null;
    const startYear = start.getFullYear();

    if (cat.affectsAnnualBalance) {
      if (seniorityYears < 1) {
        // İlk yıl: yıllık izin hakkı henüz doğmamıştır (4857/53).
        // Bakiye düşülmez; ücretli/ücretsiz kararını onaylayan verir.
        requiresPaymentDecision = true;
        deductFromYear = null;
      } else {
        const balance = await this.prisma.leaveBalance.findUnique({
          where: {
            personnelId_year_type: {
              personnelId,
              year: startYear,
              type: LeaveType.ANNUAL,
            },
          },
        });
        const remaining = balance?.remainingDays ?? 0;
        if (remaining >= totalDays) {
          // Bakiye yeterli: bu yılki bakiyeden düşülür (normal akış).
          deductFromYear = startYear;
        } else {
          // Bakiye yetersiz: TALEP ENGELLENMEZ. Onaylayan ücretli/ücretsiz seçer;
          // ücretli onaylanırsa GELECEK yılın bakiyesinden düşülür.
          requiresPaymentDecision = true;
          deductFromYear = startYear + 1;
        }
      }
    } else if (seniorityYears < 1 && cat.isPaid) {
      // Yıllık bakiyeyi etkilemeyen ama ücretli sayılabilecek izin + ilk yıl:
      // ücretli/ücretsiz kararı onayda verilir (bakiye yok).
      requiresPaymentDecision = true;
      deductFromYear = null;
    }

    // Onay zinciri: amir amir yukarı. Amir yoksa İK/Admin'e düşer.
    const chain = await this.buildApproverChain(personnelId);
    let approvers = chain;
    if (approvers.length === 0) {
      const fb = await this.fallbackApprover(personnelId);
      approvers = fb ? [fb] : [];
    }

    // Genel kural: yönetici zinciri onayladıktan sonra son adım olarak İK onaylar.
    const hrId = await this.finalHrApprover(personnelId);
    if (hrId && !approvers.includes(hrId)) {
      approvers = [...approvers, hrId];
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          personnelId,
          // Sistem kategorisi ise enum'u da koru (eski ekranlar okuyabilsin)
          type: cat.enumType ?? null,
          categoryId: cat.id ?? null,
          startDate: start,
          endDate: end,
          totalDays,
          reason: dto.reason,
          documentUrl: dto.documentUrl,
          requiresPaymentDecision,
          deductFromYear,
          currentStepOrder: 1,
        },
      });

      if (approvers.length > 0) {
        await tx.leaveApprovalStep.createMany({
          data: approvers.map((approverId, idx) => ({
            requestId: request.id,
            approverId,
            stepOrder: idx + 1,
          })),
        });

        // İlk amire "onayına sunuldu" bildirimi
        await this.notifications.create(
          {
            recipientId: approvers[0],
            senderId: personnelId,
            type: NotificationType.LEAVE_APPROVAL_PENDING,
            title: 'Yeni izin onayı bekliyor',
            body: `${personnel.firstName} ${personnel.lastName} ${totalDays} günlük izin talebinde bulundu. Onayınıza sunuldu.`,
            refType: 'LeaveRequest',
            refId: request.id,
          },
          tx,
        );
      }

      return request;
    });
  }

  /**
   * İzin onay/red. Yalnızca SIRADAKİ amir (veya ADMIN) işlem yapabilir.
   * @param approverRole çağıran kullanıcının rolü (ADMIN override için)
   */
  async approve(
    requestId: string,
    approverPersonnelId: string,
    dto: ApproveLeaveDto,
    approverRole?: string,
  ) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        personnel: true,
        category: true,
        approvalSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });
    if (!req) throw new NotFoundException('İzin talebi bulunamadı');
    if (req.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Bu talep zaten işlem görmüş');
    }

    const steps = req.approvalSteps;
    const isAdmin = approverRole === 'ADMIN';

    // Sıradaki adımı bul
    const currentStep = steps.find(
      (s) => s.stepOrder === req.currentStepOrder,
    );

    // Onay zinciri olan modern talepler için yetki kontrolü
    if (steps.length > 0) {
      if (!currentStep) {
        throw new BadRequestException('Onay zincirinde aktif adım bulunamadı');
      }
      const isCurrentApprover = currentStep.approverId === approverPersonnelId;
      if (!isCurrentApprover && !isAdmin) {
        throw new ForbiddenException(
          'Şu an bu talebi onaylama sırası sizde değil',
        );
      }
    }

    const isFinalStep = steps.length === 0 || req.currentStepOrder >= steps.length;

    // İlk yıl izinlerinde ödeme tipi yalnızca SON onayda zorunlu
    if (dto.approved && isFinalStep && req.requiresPaymentDecision && !dto.paymentType) {
      throw new BadRequestException(
        'İlk yıl izni için ödeme tipi (ücretli/ücretsiz) belirtilmelidir',
      );
    }

    // Bakiyeyi etkiler mi? (kategori varsa ondan, yoksa eski enum'dan)
    const affectsBalance = req.category
      ? req.category.affectsAnnualBalance
      : req.type === LeaveType.ANNUAL;

    const requesterName = `${req.personnel.firstName} ${req.personnel.lastName}`;

    return this.prisma.$transaction(async (tx) => {
      // Mevcut adımı işaretle
      if (currentStep) {
        await tx.leaveApprovalStep.update({
          where: { id: currentStep.id },
          data: {
            status: dto.approved
              ? ApprovalStepStatus.APPROVED
              : ApprovalStepStatus.REJECTED,
            note: dto.approved ? null : dto.rejectionReason ?? null,
            decidedAt: new Date(),
          },
        });
      }

      // ---- RED ----
      if (!dto.approved) {
        // Kalan adımları atla
        await tx.leaveApprovalStep.updateMany({
          where: { requestId, status: ApprovalStepStatus.PENDING },
          data: { status: ApprovalStepStatus.SKIPPED },
        });

        const updated = await tx.leaveRequest.update({
          where: { id: requestId },
          data: {
            status: LeaveStatus.REJECTED,
            approverId: approverPersonnelId,
            approvedAt: new Date(),
            rejectionReason: dto.rejectionReason ?? null,
          },
        });

        await this.notifications.create(
          {
            recipientId: req.personnelId,
            senderId: approverPersonnelId,
            type: NotificationType.LEAVE_REJECTED,
            title: 'İzin talebiniz reddedildi',
            body: dto.rejectionReason
              ? `Gerekçe: ${dto.rejectionReason}`
              : 'İzin talebiniz reddedildi.',
            refType: 'LeaveRequest',
            refId: requestId,
          },
          tx,
        );

        return updated;
      }

      // ---- ONAY (ara adım) ----
      if (!isFinalStep) {
        const nextOrder = req.currentStepOrder + 1;
        const updated = await tx.leaveRequest.update({
          where: { id: requestId },
          data: { currentStepOrder: nextOrder },
        });

        const nextStep = steps.find((s) => s.stepOrder === nextOrder);
        if (nextStep) {
          await this.notifications.create(
            {
              recipientId: nextStep.approverId,
              senderId: req.personnelId,
              type: NotificationType.LEAVE_APPROVAL_PENDING,
              title: 'Yeni izin onayı bekliyor',
              body: `${requesterName} ${req.totalDays} günlük izin talebinde bulundu. Bir alt amir onayladı, sıra sizde.`,
              refType: 'LeaveRequest',
              refId: requestId,
            },
            tx,
          );
        }
        return updated;
      }

      // ---- ONAY (son adım = nihai onay) ----
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: LeaveStatus.APPROVED,
          approverId: approverPersonnelId,
          approvedAt: new Date(),
          paymentType: req.requiresPaymentDecision
            ? dto.paymentType ?? null
            : null,
        },
      });

      // Bakiye düşümü:
      //  - Ücretli mi? requiresPaymentDecision varsa onaylayanın seçimine, yoksa normal
      //    yıllık izin onayı zaten ücretlidir.
      //  - deductFromYear hangi yılın bakiyesinden düşüleceğini söyler (gelecek yıl olabilir).
      //    null ise hiç düşülmez (ücretsiz / ilk yıl / yıllık-dışı izin).
      const paid = req.requiresPaymentDecision
        ? dto.paymentType === 'PAID'
        : true;

      if (affectsBalance && paid && req.deductFromYear != null) {
        await tx.leaveBalance.upsert({
          where: {
            personnelId_year_type: {
              personnelId: req.personnelId,
              year: req.deductFromYear,
              type: LeaveType.ANNUAL,
            },
          },
          update: {
            usedDays: { increment: req.totalDays },
            remainingDays: { decrement: req.totalDays },
          },
          // Gelecek yıl bakiyesi henüz tanımlı değilse oluştur (eksiye düşebilir = borç).
          create: {
            personnelId: req.personnelId,
            year: req.deductFromYear,
            type: LeaveType.ANNUAL,
            totalDays: 0,
            usedDays: req.totalDays,
            remainingDays: -req.totalDays,
          },
        });
      }

      const paymentNote =
        req.requiresPaymentDecision && dto.paymentType
          ? dto.paymentType === 'PAID'
            ? ' (ücretli olarak)'
            : ' (ücretsiz olarak)'
          : '';

      await this.notifications.create(
        {
          recipientId: req.personnelId,
          senderId: approverPersonnelId,
          type: NotificationType.LEAVE_APPROVED,
          title: 'İzin talebiniz onaylandı',
          body: `${req.totalDays} günlük izniniz onaylandı${paymentNote}.`,
          refType: 'LeaveRequest',
          refId: requestId,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Henüz hiç onaylanmamış (PENDING) kendi talebini geri çeker. Onaylı izinler
   * için kullanılamaz; amir onayı gerektiren iptal talebi akışı kullanılmalı
   * (bkz. requestCancellation) çünkü onaylı izin başka kişilerin (ör. amir,
   * vardiya planı) artık üzerine plan yaptığı bir taahhüttür.
   */
  async cancel(requestId: string, personnelId: string) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    if (req.personnelId !== personnelId)
      throw new ForbiddenException('Bu talep size ait değil');
    if (req.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Yalnızca onay bekleyen (henüz onaylanmamış) talepler bu şekilde iptal edilebilir',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveStatus.CANCELLED },
      });
      // Bekleyen onay adımlarını da kapat
      await tx.leaveApprovalStep.updateMany({
        where: { requestId, status: ApprovalStepStatus.PENDING },
        data: { status: ApprovalStepStatus.SKIPPED },
      });
      return updated;
    });
  }

  /**
   * Onaylı bir izni iptal etmek artık doğrudan silinmiyor; amirin onayına sunulur.
   * Henüz başlamamış olmalı (başlamış izin hiçbir şekilde iptal edilemez).
   */
  async requestCancellation(requestId: string, personnelId: string) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { personnel: true },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    if (req.personnelId !== personnelId) {
      throw new ForbiddenException('Bu talep size ait değil');
    }
    if (req.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException(
        'Yalnızca onaylanmış izinler için iptal talebi oluşturulabilir',
      );
    }
    if (req.startDate <= new Date()) {
      throw new BadRequestException('Başlamış izin iptal edilemez');
    }

    const approverId =
      req.personnel.managerId ?? (await this.fallbackApprover(personnelId));
    if (!approverId) {
      throw new BadRequestException(
        'İptal talebinizi onaylayacak bir amir bulunamadı',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveStatus.CANCEL_REQUESTED,
        cancelApproverId: approverId,
        cancelRequestedAt: new Date(),
        cancelRejectionReason: null,
      },
    });

    await this.notifications.create({
      recipientId: approverId,
      senderId: personnelId,
      type: NotificationType.LEAVE_CANCEL_PENDING,
      title: 'İzin iptal talebi onayınızı bekliyor',
      body: `${req.personnel.firstName} ${req.personnel.lastName} onaylı izninin iptalini talep etti.`,
      refType: 'LeaveRequest',
      refId: requestId,
    });

    return updated;
  }

  /**
   * İptal talebine amirin kararı. Onaylanırsa izin gerçekten iptal edilir
   * (bakiye varsa iade edilir); reddedilirse izin APPROVED olarak kalmaya devam eder.
   */
  async decideCancellation(
    requestId: string,
    approverPersonnelId: string,
    approved: boolean,
    role?: string,
    rejectionReason?: string,
  ) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { category: true, personnel: true },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    if (req.status !== LeaveStatus.CANCEL_REQUESTED) {
      throw new BadRequestException('Bu talep için bekleyen bir iptal talebi yok');
    }
    const isAdmin = role === 'ADMIN';
    if (req.cancelApproverId !== approverPersonnelId && !isAdmin) {
      throw new ForbiddenException('Bu iptal talebini onaylama yetkiniz yok');
    }

    if (!approved) {
      const updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: LeaveStatus.APPROVED,
          cancelRejectionReason: rejectionReason ?? null,
        },
      });
      await this.notifications.create({
        recipientId: req.personnelId,
        senderId: approverPersonnelId,
        type: NotificationType.LEAVE_CANCEL_REJECTED,
        title: 'İzin iptal talebiniz reddedildi',
        body: rejectionReason
          ? `Gerekçe: ${rejectionReason}. İzniniz geçerliliğini koruyor.`
          : 'İzniniz geçerliliğini koruyor.',
        refType: 'LeaveRequest',
        refId: requestId,
      });
      return { ...updated, message: 'İptal talebi reddedildi, izin geçerliliğini koruyor.' };
    }

    if (req.startDate <= new Date()) {
      throw new BadRequestException(
        'İzin onay beklerken başlamış; artık iptal edilemez',
      );
    }

    // Genel kural: yönetici onayladıktan sonra son adım İK'dır. Onaylayan
    // zaten İK değilse ve başka bir aktif İK varsa, iptal talebi ona devredilir.
    const approverPersonnel = await this.prisma.personnel.findUnique({
      where: { id: approverPersonnelId },
      select: { user: { select: { role: true } } },
    });
    if (approverPersonnel?.user.role !== Role.HR) {
      const hrId = await this.finalHrApprover(req.personnelId);
      if (hrId && hrId !== approverPersonnelId) {
        const updated = await this.prisma.leaveRequest.update({
          where: { id: requestId },
          data: { cancelApproverId: hrId, cancelRequestedAt: new Date() },
        });
        await this.notifications.create({
          recipientId: hrId,
          senderId: approverPersonnelId,
          type: NotificationType.LEAVE_CANCEL_PENDING,
          title: 'İzin iptal talebi onayınızı bekliyor',
          body: `${req.personnel.firstName} ${req.personnel.lastName} onaylı izninin iptalini talep etti (yönetici onayladı, son onay sizde).`,
          refType: 'LeaveRequest',
          refId: requestId,
        });
        return {
          ...updated,
          message: 'Onayınız kaydedildi; son onay için İK\'ya iletildi.',
        };
      }
    }

    const affectsBalance = req.category
      ? req.category.affectsAnnualBalance
      : req.type === LeaveType.ANNUAL;
    const wasPaid = req.requiresPaymentDecision
      ? req.paymentType === 'PAID'
      : true;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveStatus.CANCELLED },
      });

      if (affectsBalance && wasPaid && req.deductFromYear != null) {
        await tx.leaveBalance
          .update({
            where: {
              personnelId_year_type: {
                personnelId: req.personnelId,
                year: req.deductFromYear,
                type: LeaveType.ANNUAL,
              },
            },
            data: {
              usedDays: { decrement: req.totalDays },
              remainingDays: { increment: req.totalDays },
            },
          })
          .catch(() => null);
      }

      await this.notifications.create(
        {
          recipientId: req.personnelId,
          senderId: approverPersonnelId,
          type: NotificationType.LEAVE_CANCEL_APPROVED,
          title: 'İzin iptal talebiniz onaylandı',
          body: `${req.totalDays} günlük izniniz iptal edildi.`,
          refType: 'LeaveRequest',
          refId: requestId,
        },
        tx,
      );

      return { ...updated, message: 'İzin iptal edildi.' };
    });
  }

  myRequests(personnelId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { personnelId },
      include: {
        category: true,
        approvalSteps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            approver: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Onay sırası ŞU AN bu kişide olan bekleyen talepler.
   * (Organizasyon şemasında: yalnızca sıradaki amir görür.)
   */
  async pendingForManager(managerId: string) {
    const steps = await this.prisma.leaveApprovalStep.findMany({
      where: {
        approverId: managerId,
        status: ApprovalStepStatus.PENDING,
        request: { status: LeaveStatus.PENDING },
      },
      include: {
        request: {
          include: {
            personnel: {
              select: { firstName: true, lastName: true, employeeNo: true },
            },
            category: true,
            approvalSteps: { select: { stepOrder: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return steps
      .filter((s) => s.stepOrder === s.request.currentStepOrder)
      .map((s) => {
        const { approvalSteps, ...rest } = s.request;
        return {
          ...rest,
          stepOrder: s.stepOrder,
          totalSteps: approvalSteps.length,
          isFinalStep: s.stepOrder >= approvalSteps.length,
        };
      });
  }

  /**
   * Onayını bekleyen iptal talepleri. HR/Admin tümünü görür; diğerleri
   * yalnızca kendilerine atanmış (cancelApproverId) talepleri görür.
   */
  pendingCancellations(personnelId: string, role: string) {
    const seesAll = ['HR', 'ADMIN'].includes(role);
    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.CANCEL_REQUESTED,
        ...(seesAll ? {} : { cancelApproverId: personnelId }),
      },
      include: {
        personnel: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
        category: true,
      },
      orderBy: { cancelRequestedAt: 'asc' },
    });
  }

  myBalance(personnelId: string, year?: number) {
    return this.prisma.leaveBalance.findMany({
      where: { personnelId, year: year || new Date().getFullYear() },
    });
  }

  /**
   * İzin talebini siler. Sahibi kendi talebini, HR/ADMIN ise herkesinkini silebilir.
   * Onaylı + ücretli + bir yıla yazılmış izinlerde bakiye iade edilir.
   */
  async remove(requestId: string, personnelId: string, role: string) {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    const isPrivileged = ['HR', 'ADMIN'].includes(role);
    if (req.personnelId !== personnelId && !isPrivileged) {
      throw new ForbiddenException('Bu talep size ait değil');
    }

    // Onaylı (veya onayı zaten istenmiş) izinler doğrudan silinemez; amir
    // onayı gerektiren iptal talebi akışından geçmeli (requestCancellation).
    if (
      req.status === LeaveStatus.APPROVED ||
      req.status === LeaveStatus.CANCEL_REQUESTED
    ) {
      throw new BadRequestException(
        'Onaylanmış bir izin doğrudan silinemez; amir onayı gerektiren iptal talebi oluşturun',
      );
    }

    // Onay adımları cascade ile silinir (schema onDelete: Cascade)
    await this.prisma.leaveRequest.delete({ where: { id: requestId } });
    return { success: true };
  }

  /**
   * İzin listesi (alınan/onaylı izinler, tarihleriyle).
   * Görünürlük:
   *  - HR / ACCOUNTING / ADMIN: tüm personelin izinleri
   *  - MANAGER (alanın üstü): yalnızca kendi hiyerarşik alt ağacındaki personeller
   *  - Diğer: yalnızca kendisi
   */
  async leaveList(
    personnelId: string,
    role: string,
    filters: { status?: string; year?: number } = {},
  ) {
    const where: any = {};

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    } else if (!filters.status) {
      where.status = LeaveStatus.APPROVED;
    }

    if (filters.year) {
      where.startDate = {
        gte: new Date(filters.year, 0, 1),
        lt: new Date(filters.year + 1, 0, 1),
      };
    }

    const seesAll = ['HR', 'ACCOUNTING', 'ADMIN'].includes(role);
    if (!seesAll) {
      const subtree = await this.descendantIds(personnelId);
      where.personnelId = subtree.length > 0 ? { in: subtree } : personnelId;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        personnel: {
          select: {
            firstName: true,
            lastName: true,
            employeeNo: true,
            department: { select: { name: true } },
          },
        },
        category: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 500,
    });
  }

  /** Bu personelin tüm alt ağacındaki personel ID'leri (özyinelemeli). */
  private async descendantIds(personnelId: string): Promise<string[]> {
    const result: string[] = [];
    let frontier = [personnelId];
    const seen = new Set<string>([personnelId]);

    for (let depth = 0; depth < 15 && frontier.length > 0; depth++) {
      const kids = await this.prisma.personnel.findMany({
        where: { managerId: { in: frontier } },
        select: { id: true },
      });
      frontier = [];
      for (const k of kids) {
        if (!seen.has(k.id)) {
          seen.add(k.id);
          result.push(k.id);
          frontier.push(k.id);
        }
      }
    }
    return result;
  }

  /**
   * Bu personelin görebileceği aktif izin kategorileri.
   * Görünürlük: kişiye özel istisna varsa o, yoksa kategorinin defaultVisible değeri.
   */
  async availableCategories(personnelId: string) {
    const cats = await this.prisma.leaveCategory.findMany({
      where: { isActive: true },
      include: { accesses: { where: { personnelId } } },
      orderBy: { name: 'asc' },
    });
    return cats
      .filter((c) => {
        const override = c.accesses[0];
        return override ? override.visible : c.defaultVisible;
      })
      .map(({ accesses: _accesses, ...rest }) => rest);
  }

  // ============= TATİLLER =============
  listHolidays(year?: number) {
    const where: any = {};
    if (year) {
      where.OR = [
        { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
        { recurring: true },
      ];
    }
    return this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
  }

  createHoliday(data: any) {
    return this.prisma.holiday.create({ data: { ...data, date: new Date(data.date) } });
  }

  async removeHoliday(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Tatil bulunamadı');
    await this.prisma.holiday.delete({ where: { id } });
    return { success: true };
  }

  // === Helpers ===

  /**
   * Personelin amir zincirini (en yakından en üste) döner.
   * Cycle koruması ve 15 adım üst sınırı vardır; pasif amirler atlanır.
   */
  private async buildApproverChain(personnelId: string): Promise<string[]> {
    const chain: string[] = [];
    const seen = new Set<string>([personnelId]);
    let currentId = personnelId;

    for (let i = 0; i < 15; i++) {
      const p = await this.prisma.personnel.findUnique({
        where: { id: currentId },
        select: { managerId: true },
      });
      const mgrId = p?.managerId;
      if (!mgrId || seen.has(mgrId)) break;
      seen.add(mgrId);

      const mgr = await this.prisma.personnel.findUnique({
        where: { id: mgrId },
        select: { id: true, status: true },
      });
      if (!mgr) break;
      if (mgr.status === 'ACTIVE') chain.push(mgr.id);
      currentId = mgrId;
    }
    return chain;
  }

  /** Amiri olmayan personel için onay İK/Admin'e düşer. */
  private async fallbackApprover(personnelId: string): Promise<string | null> {
    const hr = await this.prisma.personnel.findFirst({
      where: {
        status: 'ACTIVE',
        id: { not: personnelId },
        user: { role: { in: ['HR', 'ADMIN'] } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return hr?.id ?? null;
  }

  /**
   * Genel kural: yönetici zinciri onayladıktan sonra son adım İK'dır.
   * İK personelin kendisiyse veya aktif başka bir İK yoksa adım eklenmez.
   */
  private async finalHrApprover(personnelId: string): Promise<string | null> {
    const hr = await this.prisma.personnel.findFirst({
      where: {
        status: 'ACTIVE',
        id: { not: personnelId },
        user: { role: Role.HR },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return hr?.id ?? null;
  }

  /**
   * Talepteki kategoriyi çözer.
   * Öncelik: categoryId -> (yoksa) eski enum türü.
   */
  private async resolveCategory(dto: CreateLeaveRequestDto): Promise<{
    id: string | null;
    enumType: LeaveType | null;
    affectsAnnualBalance: boolean;
    isPaid: boolean;
  }> {
    if (dto.categoryId) {
      const cat = await this.prisma.leaveCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat || !cat.isActive) {
        throw new BadRequestException('Geçersiz izin kategorisi');
      }
      const enumType = (Object.values(LeaveType) as string[]).includes(cat.code)
        ? (cat.code as LeaveType)
        : null;
      return {
        id: cat.id,
        enumType,
        affectsAnnualBalance: cat.affectsAnnualBalance,
        isPaid: cat.isPaid,
      };
    }

    if (dto.type) {
      const cat = await this.prisma.leaveCategory.findUnique({
        where: { code: dto.type },
      });
      if (cat) {
        return {
          id: cat.id,
          enumType: dto.type,
          affectsAnnualBalance: cat.affectsAnnualBalance,
          isPaid: cat.isPaid,
        };
      }
      return {
        id: null,
        enumType: dto.type,
        affectsAnnualBalance: dto.type === LeaveType.ANNUAL,
        isPaid: true,
      };
    }

    throw new BadRequestException('İzin türü veya kategori belirtilmelidir');
  }

  /**
   * İzin gün sayısı: takvim günü, BİTİŞ tarihi hariç (dönüş günü sayılmaz).
   * Örn. 26.06 -> 28.06 = 2 gün (26 ve 27). Aynı gün seçilirse en az 1 gün.
   * (Hafta sonu/resmi tatil ayrımı yapılmaz — kullanıcı tercihi.)
   */
  private async calculateBusinessDays(start: Date, end: Date): Promise<number> {
    const s = dayjs(start).startOf('day');
    const e = dayjs(end).startOf('day');
    const diff = e.diff(s, 'day');
    return diff <= 0 ? 1 : diff;
  }
}
