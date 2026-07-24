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
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import { CreateLeaveRequestDto, ApproveLeaveDto, CreateHourlyLeaveDto } from './leave.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { cumulativeAnnualLeaveEntitlement } from './leave-entitlement.util';
import { getHistoricalOverride } from './leave-historical-overrides.util';

dayjs.extend(utc);
dayjs.extend(timezone);

// Sunucu (Railway) UTC'de çalışıyor; PDF'lerdeki "oluşturulma tarihi" gibi
// anlık zaman damgaları Türkiye saatine göre gösterilmeli.
const TZ = 'Europe/Istanbul';

@Injectable()
export class LeaveService {
  // require.resolve(paket adı) "main" alanı olmayan paketlerde başarısız olur;
  // package.json'ı resolve ederek paketin kurulu olduğu dizini güvenilir buluyoruz.
  private readonly fontsDir = path.join(
    path.dirname(require.resolve('dejavu-fonts-ttf/package.json')),
    'ttf',
  );
  private readonly logoPath = path.join(__dirname, '..', '..', 'assets', 'logo.png');
  private readonly brandColor = '#1e3a8a';
  private readonly brandTint = '#eef2ff';

  /** PDF'in sağ üst köşesine uygulama logosunu yerleştirir; dosya yoksa (ör.
   * derlenmemiş test ortamı) sessizce atlanır, belge logosuz üretilmeye devam eder. */
  private addLogo(doc: PDFKit.PDFDocument) {
    try {
      const width = 70;
      const topGap = 10;
      const x = doc.page.width - doc.page.margins.right - width;
      doc.image(this.logoPath, x, topGap, { width });
      doc.y = Math.max(doc.y, topGap + width + 8); // logo karesel (1024x1024)
    } catch {
      // yoksay
    }
  }

  /** Başlığın altına marka renginde ince bir ayraç çizgisi çizer. */
  private addAccentRule(doc: PDFKit.PDFDocument) {
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.moveTo(x, doc.y).lineTo(x + width, doc.y).lineWidth(2).strokeColor(this.brandColor).stroke();
    doc.strokeColor('black').lineWidth(1);
  }

  /** Sayfanın altına ince bir çizgi + belge künyesi ekler. */
  private addFooter(doc: PDFKit.PDFDocument) {
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lineY = doc.page.height - doc.page.margins.bottom + 18;
    doc.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    // Metin, sayfanın alt boşluk (margin) alanına yazılıyor; PDFKit normalde
    // bunu "sayfa taştı" sanıp otomatik yeni bir sayfa ekler. Metni yazarken
    // alt marjini geçici olarak sıfırlayıp bu davranışı engelliyoruz.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('DejaVu').fontSize(8).fillColor('#9ca3af').text(
      'Bu belge İKYS üzerinden elektronik olarak oluşturulmuştur.',
      x,
      lineY + 6,
      { width, align: 'center' },
    );
    doc.page.margins.bottom = originalBottomMargin;
    doc.fillColor('black').strokeColor('black');
  }

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

    // Yarım gün: tek gün olmalı, seans (AM/PM) zorunlu, her zaman 0.5 gün sayılır.
    const isHalfDay = dto.type === LeaveType.HALF_DAY;
    if (isHalfDay) {
      if (start.getTime() !== end.getTime()) {
        throw new BadRequestException('Yarım gün izin sadece tek bir gün için alınabilir');
      }
      if (dto.halfDayPeriod !== 'AM' && dto.halfDayPeriod !== 'PM') {
        throw new BadRequestException('Yarım gün için seans (öğleden önce/sonra) seçilmeli');
      }
    }

    // İş günü hesabı (resmi tatiller hariç); yarım gün her zaman 0.5 sayılır
    // ama seçilen günün gerçekten bir iş günü olduğu yine de doğrulanır.
    const businessDays = await this.calculateBusinessDays(start, end);
    if (businessDays <= 0) {
      throw new BadRequestException('Seçilen aralıkta iş günü yok');
    }
    const totalDays = isHalfDay ? 0.5 : businessDays;

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
        // Ücretli/ücretsiz kararını onaylayan verir. Ücretsiz seçilirse zaten
        // bakiyeye dokunulmaz; ÜCRETLİ seçilirse henüz hak edilmemiş bakiyeden
        // düşülür (bakiye eksiye düşer = borç, ileride birikecek hakedişten
        // karşılanır).
        requiresPaymentDecision = true;
        deductFromYear = startYear;
      } else {
        // Canlı, hiç sıfırlanmayan kümülatif bakiye (bkz. annualLeaveSummary).
        const { remaining } = await this.annualLeaveSummary(personnelId, personnel.hireDate);
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
          halfDayPeriod: isHalfDay ? dto.halfDayPeriod : null,
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
   * İK, bir çalışana doğrudan saatlik izin tanımlar: onay zinciri yok, talep
   * zaten APPROVED olarak oluşur, yıllık izin bakiyesine hiç dokunulmaz.
   */
  async hrGrantHourlyLeave(hrPersonnelId: string, dto: CreateHourlyLeaveDto) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: dto.personnelId },
    });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');

    const date = new Date(dto.date);
    const request = await this.prisma.leaveRequest.create({
      data: {
        personnelId: dto.personnelId,
        type: LeaveType.HOURLY,
        startDate: date,
        endDate: date,
        totalDays: 0,
        reason: dto.reason,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: LeaveStatus.APPROVED,
        approverId: hrPersonnelId,
        approvedAt: new Date(),
      },
    });

    await this.notifications.create({
      recipientId: dto.personnelId,
      senderId: hrPersonnelId,
      type: NotificationType.LEAVE_APPROVED,
      title: 'Saatlik izniniz tanımlandı',
      body:
        `${dayjs(date).format('DD.MM.YYYY')} tarihinde ${dto.startTime}-${dto.endTime} ` +
        `arası saatlik izniniz İK tarafından tanımlandı.`,
      refType: 'LeaveRequest',
      refId: request.id,
    });

    return request;
  }

  /**
   * Onaylanmış bir izin talebi için "İzin Onay Belgesi" PDF'i oluşturur.
   * Sadece APPROVED durumundaki talepler için üretilebilir.
   */
  async generateApprovalPdf(requestId: string): Promise<Buffer> {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { personnel: true, approver: true, category: true },
    });
    if (!req) throw new NotFoundException('İzin talebi bulunamadı');
    if (req.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException('Sadece onaylanmış izinler için belge oluşturulabilir');
    }

    const typeLabels: Record<string, string> = {
      ANNUAL: 'Yıllık İzin',
      HALF_DAY: 'Yarım Gün İzin',
      HOURLY: 'Saatlik İzin',
      EXCUSE: 'Mazeret İzni',
      SICK: 'Sağlık Raporu',
      MATERNITY: 'Doğum İzni',
      PATERNITY: 'Babalık İzni',
      MARRIAGE: 'Evlilik İzni',
      BEREAVEMENT: 'Vefat İzni',
      UNPAID: 'Ücretsiz İzin',
    };
    const typeName = req.category?.name ?? (req.type ? typeLabels[req.type] ?? req.type : 'İzin');
    const employeeName = `${req.personnel.firstName} ${req.personnel.lastName}`;

    // Belgede kim onaylarsa onaylasın "Onaylayan" olarak her zaman İK gösterilir.
    const hr = await this.prisma.personnel.findFirst({
      where: { status: 'ACTIVE', user: { role: Role.HR } },
      orderBy: { createdAt: 'asc' },
    });
    const approverName = hr
      ? `${hr.firstName} ${hr.lastName}`
      : req.approver
        ? `${req.approver.firstName} ${req.approver.lastName}`
        : '-';
    const fmt = (d: Date) => dayjs(d).format('DD.MM.YYYY');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('DejaVu', path.join(this.fontsDir, 'DejaVuSans.ttf'));
      doc.registerFont('DejaVu-Bold', path.join(this.fontsDir, 'DejaVuSans-Bold.ttf'));
      doc.font('DejaVu');
      this.addLogo(doc);

      doc.font('DejaVu-Bold').fontSize(18).text('İZİN ONAY BELGESİ', { align: 'center' });
      doc.moveDown(0.5);
      this.addAccentRule(doc);
      doc.moveDown(2);

      const dayText =
        req.totalDays === 1 ? '1 günlük' : `${req.totalDays.toString().replace('.', ',')} günlük`;
      const periodText =
        req.halfDayPeriod === 'AM'
          ? ' (09:00-13:30 öğleden önce)'
          : req.halfDayPeriod === 'PM'
            ? ' (13:30-18:00 öğleden sonra)'
            : req.startTime && req.endTime
              ? ` (${req.startTime}-${req.endTime})`
              : '';

      // Sade, resmi anlatım metni: sadece kişi adları kalın, renk/kart yok.
      const boxX = doc.page.margins.left;
      const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const segments: { text: string; bold?: boolean }[] = [
        { text: employeeName, bold: true },
        { text: ', İKYS uygulaması üzerinden ' },
        { text: `${fmt(req.startDate)} - ${fmt(req.endDate)}` },
        { text: ' tarihleri arasında ' },
        { text: `${typeName}${periodText}` },
        { text: ' kapsamında ' },
        { text: dayText },
        { text: ' izin talebinde bulunmuştur. ' },
        { text: approverName, bold: true },
        { text: ' tarafından onaylanmıştır.' },
      ];
      const startY = doc.y;
      segments.forEach((seg, i) => {
        doc.font(seg.bold ? 'DejaVu-Bold' : 'DejaVu').fontSize(12).fillColor('#111827');
        if (i === 0) {
          doc.text(seg.text, boxX, startY, { continued: true, width: boxWidth, lineGap: 5 });
        } else {
          doc.text(seg.text, { continued: i < segments.length - 1 });
        }
      });
      doc.fillColor('black').strokeColor('black');
      doc.moveDown(3);

      // İmza benzeri kapanış: onaylayan adı ve onay tarihi, üstlerinde ince
      // bir çizgiyle imza satırı gibi ayrılmış iki sütun.
      const sigColWidth = boxWidth / 2 - 16;
      const sigY = doc.y;
      doc.moveTo(boxX, sigY).lineTo(boxX + sigColWidth, sigY).strokeColor('#d1d5db').lineWidth(1).stroke();
      doc.font('DejaVu-Bold').fontSize(11).fillColor('#111827').text(approverName, boxX, sigY + 8);
      doc.font('DejaVu').fontSize(8).fillColor('#9ca3af').text('ONAYLAYAN', boxX, sigY + 24);

      const sigX2 = boxX + boxWidth - sigColWidth;
      doc.moveTo(sigX2, sigY).lineTo(sigX2 + sigColWidth, sigY).strokeColor('#d1d5db').lineWidth(1).stroke();
      doc.font('DejaVu-Bold').fontSize(11).fillColor('#111827')
        .text(fmt(req.approvedAt ?? req.updatedAt), sigX2, sigY + 8);
      doc.font('DejaVu').fontSize(8).fillColor('#9ca3af').text('ONAY TARİHİ', sigX2, sigY + 24);

      doc.fillColor('black').strokeColor('black');
      this.addFooter(doc);
      doc.end();
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

      // İK'ya bilgilendirme (onay gerekmez, sadece haberdar olsun).
      const hrId = await this.finalHrApprover(req.personnelId);
      if (hrId && hrId !== req.personnelId) {
        await this.notifications.create(
          {
            recipientId: hrId,
            senderId: approverPersonnelId,
            type: NotificationType.LEAVE_APPROVED,
            title: 'Onaylanan izin bilgilendirmesi',
            body:
              `${requesterName}, ` +
              `${dayjs(req.startDate).format('DD.MM.YYYY')} - ${dayjs(req.endDate).format('DD.MM.YYYY')} ` +
              `arası izinli (${req.totalDays} gün).`,
            refType: 'LeaveRequest',
            refId: requestId,
          },
          tx,
        );
      }

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
      orderBy: { startDate: 'desc' },
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
   * Onayını bekleyen iptal talepleri. Sıralı akış: yalnızca o an sırada
   * (cancelApproverId) olan kişi görür — rol ne olursa olsun (HR/ADMIN dahil),
   * kendine devredilmemiş bir talebi göremez.
   */
  pendingCancellations(personnelId: string, _role: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.CANCEL_REQUESTED,
        cancelApproverId: personnelId,
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

  /**
   * Yıllık izin hakkı, işe giriş tarihinden bu yana biriken toplam kıdeme göre
   * CANLI hesaplanır ve hiç sıfırlanmaz (bkz. leave-entitlement.util.ts).
   * "Kullanılan" miktar, personelin ANNUAL tipli tüm yılların bakiye
   * satırlarındaki usedDays toplamıdır (hangi yıl satırına yazıldığı önemli
   * değil, hepsi aynı biriken havuza sayılır).
   */
  private async annualLeaveSummary(personnelId: string, hireDate: Date, asOf = new Date()) {
    const totalEntitled = cumulativeAnnualLeaveEntitlement(hireDate, asOf);
    const rows = await this.prisma.leaveBalance.findMany({
      where: { personnelId, type: LeaveType.ANNUAL },
    });
    const used = rows.reduce((sum, r) => sum + r.usedDays, 0);
    return { totalEntitled, used, remaining: totalEntitled - used };
  }

  async myBalance(personnelId: string, year?: number) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { hireDate: true },
    });
    if (!personnel) return [];

    const otherRows = await this.prisma.leaveBalance.findMany({
      where: {
        personnelId,
        type: { not: LeaveType.ANNUAL },
        year: year || new Date().getFullYear(),
      },
    });

    const annual = await this.annualLeaveSummary(personnelId, personnel.hireDate);
    const annualRow = {
      id: `${personnelId}-ANNUAL`,
      personnelId,
      year: new Date().getFullYear(),
      type: LeaveType.ANNUAL,
      totalDays: annual.totalEntitled,
      usedDays: annual.used,
      remainingDays: annual.remaining,
    };

    return [annualRow, ...otherRows];
  }

  /**
   * HR/Admin: tüm aktif personelin yıllık izin hakedişi, kullanılan/kalan
   * günleri ve onaylanmış izin tarihleri (Belge: "Savaş ve İK herkesin
   * iznini görebilsin, diğerleri sadece kendi iznini görsün").
   */
  async allAnnualBalances() {
    // İK ve hiyerarşinin en tepesindeki (yöneticisi olmayan) admin, normal
    // izin sürecinin parçası sayılmıyor — bakiye listelerinde görünmesin.
    const personnel = await this.prisma.personnel.findMany({
      where: { status: 'ACTIVE', managerId: { not: null }, user: { role: { not: Role.HR } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        hireDate: true,
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    return Promise.all(
      personnel.map(async (p) => {
        const annual = await this.annualLeaveSummary(p.id, p.hireDate);
        const takenLeaves = await this.prisma.leaveRequest.findMany({
          where: {
            personnelId: p.id,
            status: LeaveStatus.APPROVED,
            OR: [
              { type: LeaveType.ANNUAL },
              { category: { affectsAnnualBalance: true } },
            ],
          },
          select: { id: true, startDate: true, endDate: true, totalDays: true },
          orderBy: { startDate: 'desc' },
        });

        return {
          personnelId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          employeeNo: p.employeeNo,
          department: p.department?.name ?? null,
          hireDate: p.hireDate,
          totalEntitled: annual.totalEntitled,
          used: annual.used,
          remaining: annual.remaining,
          takenLeaves,
        };
      }),
    );
  }

  private static readonly MONTHS_SHORT = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ];

  /**
   * Şirketin daha önce elle tuttuğu Excel'deki (yıl bazlı sayfa: personel +
   * hakedilen/eklenen + ay ay kullanım + kalan) mantığın aynısı, canlı
   * veriden hesaplanır. Doğrulama: Savaş için 2026 yılına göre üretilen
   * "yıl sonu kalan" (36.5) + "eklenen" (20) - "bu yıl kullanılan" (13) =
   * "kalan" (43.5) — Excel'deki değerlerle birebir eşleşiyor.
   */
  private async yearlyBreakdown(
    personnelId: string,
    hireDate: Date,
    year: number,
    employeeNo?: string,
  ) {
    if (employeeNo) {
      const override = getHistoricalOverride(employeeNo, year);
      if (override) return override;
    }

    const anniversaryThis = new Date(hireDate);
    anniversaryThis.setFullYear(year);
    const anniversaryLast = new Date(hireDate);
    anniversaryLast.setFullYear(year - 1);

    // Bu yılın yıl dönümü henüz gelmediyse (örn. ilk yılını dolduran bir
    // personel için rapor "bugün"den önce üretiliyorsa) o hakedişi henüz
    // vermeyelim — aksi halde henüz doğmamış bir hak erkenden eklenmiş olur.
    const now = new Date();
    const entitledThis = cumulativeAnnualLeaveEntitlement(
      hireDate,
      anniversaryThis > now ? now : anniversaryThis,
    );
    const entitledLast = cumulativeAnnualLeaveEntitlement(
      hireDate,
      anniversaryLast > now ? now : anniversaryLast,
    );
    const eklenen = entitledThis - entitledLast;

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const balRows = await this.prisma.leaveBalance.findMany({
      where: { personnelId, type: LeaveType.ANNUAL },
    });
    const totalUsedNow = balRows.reduce((s, r) => s + r.usedDays, 0);

    // Bu yıla ait, aya göre kırılmış kullanım (yalnızca gerçek, tarihli
    // taleplerden; içe aktarılan tarihsiz "düzeltme" havuzu buna dahil değil).
    const yearRequests = await this.prisma.leaveRequest.findMany({
      where: {
        personnelId,
        status: LeaveStatus.APPROVED,
        startDate: { gte: yearStart, lte: yearEnd },
        OR: [{ type: LeaveType.ANNUAL }, { category: { affectsAnnualBalance: true } }],
      },
      select: { startDate: true, totalDays: true },
    });
    const monthly = new Array(12).fill(0);
    for (const r of yearRequests) monthly[r.startDate.getMonth()] += r.totalDays;
    const usedThisYear = monthly.reduce((s, v) => s + v, 0);

    // "Şimdi"den bu yılın sonrasına ait (henüz gerçekleşmemiş/gelecek) kullanım
    // varsa çıkar; yıl geçmişse zaten hiçbir şey düşmez.
    const afterYearRequests = await this.prisma.leaveRequest.findMany({
      where: {
        personnelId,
        status: LeaveStatus.APPROVED,
        startDate: { gt: yearEnd },
        OR: [{ type: LeaveType.ANNUAL }, { category: { affectsAnnualBalance: true } }],
      },
      select: { totalDays: true },
    });
    const usedAfterYear = afterYearRequests.reduce((s, r) => s + r.totalDays, 0);
    const usedUpToEndOfYear = totalUsedNow - usedAfterYear;
    const usedBeforeYear = usedUpToEndOfYear - usedThisYear;

    const yilSonuKalan = entitledLast - usedBeforeYear;
    const kalan = entitledThis - usedUpToEndOfYear;

    const unpaidRows = await this.prisma.leaveRequest.findMany({
      where: {
        personnelId,
        status: LeaveStatus.APPROVED,
        type: LeaveType.UNPAID,
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { totalDays: true },
    });
    const ucretsiz = unpaidRows.reduce((s, r) => s + r.totalDays, 0);

    const sickRows = await this.prisma.leaveRequest.findMany({
      where: {
        personnelId,
        status: LeaveStatus.APPROVED,
        type: LeaveType.SICK,
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { totalDays: true },
    });
    const rapor = sickRows.reduce((s, r) => s + r.totalDays, 0);

    return {
      anniversaryThis,
      eklenen,
      yilSonuKalan,
      monthly,
      kalan,
      ucretsiz,
      rapor,
    };
  }

  private fmtDays(n: number): string {
    return n === Math.trunc(n) ? `${n}` : n.toFixed(2).replace('.', ',');
  }

  /**
   * Şirketin Excel'deki yıllık izin tablosunun (personel x ay) PDF karşılığı,
   * tüm aktif personel için tek sayfa halinde.
   */
  async generateYearlyBulkPdf(year: number): Promise<Buffer> {
    // İK ve hiyerarşinin en tepesindeki (yöneticisi olmayan) admin, bu raporun
    // takip ettiği "normal" izin süreci dışında sayılır — listeye girmesin.
    // Henüz o yılın sonunda işe girmemiş personel de (örn. Emir, 2024/2025
    // raporlarında) listede yer almasın.
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const personnel = await this.prisma.personnel.findMany({
      where: {
        status: 'ACTIVE',
        managerId: { not: null },
        user: { role: { not: Role.HR } },
        hireDate: { lte: yearEnd },
      },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, hireDate: true },
      orderBy: [{ firstName: 'asc' }],
    });

    const rows = await Promise.all(
      personnel.map(async (p) => ({
        ...p,
        b: await this.yearlyBreakdown(p.id, p.hireDate, year, p.employeeNo),
      })),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 25, layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('DejaVu', path.join(this.fontsDir, 'DejaVuSans.ttf'));
      doc.registerFont('DejaVu-Bold', path.join(this.fontsDir, 'DejaVuSans-Bold.ttf'));
      doc.font('DejaVu');
      this.addLogo(doc);

      doc.font('DejaVu-Bold').fontSize(15).text(`${year} YILLIK İZİN TABLOSU`, { align: 'center' });
      doc.font('DejaVu').fontSize(8).fillColor('gray').text(
        `Oluşturulma tarihi: ${dayjs().tz(TZ).format('DD.MM.YYYY HH:mm')}`,
        { align: 'center' },
      );
      doc.fillColor('black');
      doc.moveDown(0.5);
      this.addAccentRule(doc);
      doc.moveDown(1);

      const cols: { label: string; width: number }[] = [
        { label: 'Personel', width: 100 },
        { label: 'İşe Giriş', width: 50 },
        { label: 'Eklenen', width: 42 },
        { label: 'Yıl Sonu Kalan', width: 80 },
        ...LeaveService.MONTHS_SHORT.map((m) => ({ label: m, width: 30 })),
        { label: 'Kalan', width: 42 },
        { label: 'Ücretsiz', width: 48 },
        { label: 'Rapor', width: 42 },
      ];
      const startX = doc.page.margins.left;
      const tableWidth = cols.reduce((s, c) => s + c.width, 0);
      const rowHeight = 16;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      let y = doc.y;

      // Tek bir satırı, hücreleri çizgiyle ayrılmış gerçek bir tablo satırı
      // gibi çizer (dış çerçeve + sütun ayraçları).
      const drawGridRow = (values: string[], bold: boolean, height = rowHeight) => {
        if (bold) {
          doc.rect(startX, y, tableWidth, height).fillColor(this.brandTint).fill();
        }
        doc.rect(startX, y, tableWidth, height).strokeColor('#cccccc').stroke();
        let x = startX;
        doc.font(bold ? 'DejaVu-Bold' : 'DejaVu').fontSize(7.5).fillColor(bold ? this.brandColor : 'black');
        for (let i = 0; i < cols.length; i++) {
          if (i > 0) {
            doc.moveTo(x, y).lineTo(x, y + height).strokeColor('#cccccc').stroke();
          }
          doc.text(values[i], x + 3, y + 4, { width: cols[i].width - 6 });
          x += cols[i].width;
        }
        doc.fillColor('black');
        y += height;
      };

      const drawHeader = () => {
        drawGridRow(cols.map((c) => c.label), true, 24);
      };

      drawHeader();

      for (const r of rows) {
        if (y > pageBottom - rowHeight) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        const values = [
          `${r.firstName} ${r.lastName}`,
          dayjs(r.hireDate).format('DD.MM.YY'),
          this.fmtDays(r.b.eklenen),
          this.fmtDays(r.b.yilSonuKalan),
          ...r.b.monthly.map((m) => (m ? this.fmtDays(m) : '-')),
          this.fmtDays(r.b.kalan),
          r.b.ucretsiz ? this.fmtDays(r.b.ucretsiz) : '-',
          r.b.rapor ? this.fmtDays(r.b.rapor) : '-',
        ];
        drawGridRow(values, false);
      }

      this.addFooter(doc);
      doc.end();
    });
  }

  /** Tek bir personelin yıllık izin dökümü (Excel'deki "izin detay" sayfası gibi). */
  async generatePersonYearlyPdf(personnelId: string, year: number | null): Promise<Buffer> {
    const p = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      include: { department: true },
    });
    if (!p) throw new NotFoundException('Personel kaydı bulunamadı');

    let cards: [string, string][];
    let takenLeaves: Array<{
      startDate: Date;
      endDate: Date;
      totalDays: number;
      type: string | null;
      category: { name: string } | null;
    }>;

    if (year != null) {
      const b = await this.yearlyBreakdown(personnelId, p.hireDate, year, p.employeeNo);
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      takenLeaves = await this.prisma.leaveRequest.findMany({
        where: { personnelId, status: LeaveStatus.APPROVED, startDate: { gte: yearStart, lte: yearEnd } },
        include: { category: true },
        orderBy: { startDate: 'asc' },
      });
      cards = [
        [`${year} Eklenen`, `${this.fmtDays(b.eklenen)} gün`],
        ['Yıl Sonu Kalan', `${this.fmtDays(b.yilSonuKalan)} gün`],
        ['Kalan', `${this.fmtDays(b.kalan)} gün`],
        ['Ücretsiz İzin', `${this.fmtDays(b.ucretsiz)} gün`],
        ['Rapor', `${this.fmtDays(b.rapor)} gün`],
      ];
    } else {
      // "Tüm yıllar": kademeli/yıl bazlı kırılım yerine, hiç sıfırlanmayan
      // kümülatif bakiye ve personelin tüm izin geçmişi gösterilir.
      const annual = await this.annualLeaveSummary(personnelId, p.hireDate);
      takenLeaves = await this.prisma.leaveRequest.findMany({
        where: { personnelId, status: LeaveStatus.APPROVED },
        include: { category: true },
        orderBy: { startDate: 'asc' },
      });
      cards = [
        ['Toplam Hak', `${this.fmtDays(annual.totalEntitled)} gün`],
        ['Kullanılan', `${this.fmtDays(annual.used)} gün`],
        ['Kalan', `${this.fmtDays(annual.remaining)} gün`],
      ];
    }

    const typeLabels: Record<string, string> = {
      ANNUAL: 'Yıllık İzin', HALF_DAY: 'Yarım Gün İzin', HOURLY: 'Saatlik İzin',
      EXCUSE: 'Mazeret İzni', SICK: 'Sağlık Raporu', MATERNITY: 'Doğum İzni',
      PATERNITY: 'Babalık İzni', MARRIAGE: 'Evlilik İzni', BEREAVEMENT: 'Vefat İzni',
      UNPAID: 'Ücretsiz İzin',
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('DejaVu', path.join(this.fontsDir, 'DejaVuSans.ttf'));
      doc.registerFont('DejaVu-Bold', path.join(this.fontsDir, 'DejaVuSans-Bold.ttf'));
      doc.font('DejaVu');
      this.addLogo(doc);

      doc.font('DejaVu-Bold').fontSize(16).text(
        year != null ? `${year} YILLIK İZİN DÖKÜMÜ` : 'TÜM YILLAR İZİN DÖKÜMÜ',
        { align: 'center' },
      );
      doc.moveDown(0.5);
      this.addAccentRule(doc);
      doc.moveDown(1);

      doc.font('DejaVu-Bold').fontSize(12).text(`${p.firstName} ${p.lastName}`);
      doc.font('DejaVu').fontSize(10);
      doc.text(`Sicil No: ${p.employeeNo}`);
      doc.text(`Departman: ${p.department?.name ?? '-'}`);
      doc.text(`İşe Giriş: ${dayjs(p.hireDate).format('DD.MM.YYYY')}`);
      doc.moveDown(1);

      const cardGap = 8;
      const cardWidth = (doc.page.width - 100 - cardGap * (cards.length - 1)) / cards.length;
      const cardHeight = 44;
      const cardY = doc.y;
      cards.forEach(([label, value], i) => {
        const x = 50 + i * (cardWidth + cardGap);
        doc.rect(x, cardY, cardWidth, cardHeight).fillColor(this.brandTint).fill();
        doc.rect(x, cardY, cardWidth, cardHeight).strokeColor('#dbe2fb').lineWidth(1).stroke();
        doc.font('DejaVu-Bold').fontSize(11).fillColor(this.brandColor)
          .text(value, x + 8, cardY + 10, { width: cardWidth - 16 });
        doc.font('DejaVu').fontSize(8).fillColor('#6b7280')
          .text(label, x + 8, cardY + 27, { width: cardWidth - 16 });
        doc.fillColor('black');
      });
      doc.y = cardY + cardHeight + 12;
      doc.moveDown(1);

      doc.font('DejaVu-Bold').fontSize(11).text('İZİN GEÇMİŞİ');
      doc.moveDown(0.5);

      const cols = [
        { label: 'Başlangıç', width: 90 },
        { label: 'Bitiş', width: 90 },
        { label: 'Gün', width: 60 },
        { label: 'Tür', width: 140 },
      ];
      const startX = doc.page.margins.left;
      const tableWidth = cols.reduce((s, c) => s + c.width, 0);

      const drawHeader = () => {
        let x = startX;
        const y = doc.y;
        doc.font('DejaVu-Bold').fontSize(9);
        for (const c of cols) {
          doc.text(c.label, x, y, { width: c.width });
          x += c.width;
        }
        doc.moveDown(0.5);
        doc.moveTo(startX, doc.y).lineTo(startX + tableWidth, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.3);
        doc.font('DejaVu').fontSize(9);
      };

      drawHeader();

      if (takenLeaves.length === 0) {
        doc.fillColor('gray').text(year != null ? 'Bu yıl için kayıtlı izin yok.' : 'Kayıtlı izin yok.');
        doc.fillColor('black');
      }

      for (const r of takenLeaves) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          drawHeader();
        }
        let x = startX;
        const y = doc.y;
        const typeName = r.category?.name ?? (r.type ? typeLabels[r.type] ?? r.type : '-');
        const values = [
          dayjs(r.startDate).format('DD.MM.YYYY'),
          dayjs(r.endDate).format('DD.MM.YYYY'),
          `${this.fmtDays(r.totalDays)} gün`,
          typeName,
        ];
        values.forEach((v, i) => {
          doc.text(v, x, y, { width: cols[i].width });
          x += cols[i].width;
        });
        doc.moveDown(0.6);
      }

      this.addFooter(doc);
      doc.end();
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
/** İzin listesinde görebileceği personel id'leri (rol/hiyerarşiye göre). null = herkes. */
  private async leaveListScope(personnelId: string, role: string): Promise<string[] | null> {
    const seesAll = ['HR', 'ACCOUNTING', 'ADMIN'].includes(role);
    if (seesAll) return null;
    const subtree = await this.descendantIds(personnelId);
    return subtree.length > 0 ? subtree : [personnelId];
  }

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

    const scope = await this.leaveListScope(personnelId, role);
    if (scope) where.personnelId = { in: scope };

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

  /**
   * İzin Listesi'nde seçilebilecek personel listesi (rol/hiyerarşiye göre) —
   * izin talebi olsun olmasın, kapsamdaki HERKESİ döner (Savaş/İK her zaman
   * tüm personeli görsün istendiği için).
   */
  async leaveListPersonnel(personnelId: string, role: string) {
    const scope = await this.leaveListScope(personnelId, role);
    return this.prisma.personnel.findMany({
      where: {
        status: 'ACTIVE',
        // İK ve hiyerarşinin en tepesindeki (yöneticisi olmayan) admin,
        // normal izin sürecinin parçası sayılmıyor — listede görünmesin.
        managerId: { not: null },
        user: { role: { not: Role.HR } },
        ...(scope ? { id: { in: scope } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }],
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
  /**
   * Belirtilen yılın tüm resmi tatilleri. Sabit tarihli (recurring) tatiller
   * DB'de hangi yıl kaydedilmiş olursa olsun, gösterilen yıla göre ay/gün
   * korunarak tarihi o yıla uyarlanır (yoksa hep kayıtlı oldukları yıl
   * görünür — bkz. eski hata: hepsi "2025" gösteriyordu).
   */
  async listHolidays(year?: number) {
    const y = year ?? new Date().getFullYear();
    const rows = await this.prisma.holiday.findMany({
      where: {
        OR: [
          { date: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } },
          { recurring: true },
        ],
      },
    });
    return rows
      .map((h) => {
        if (!h.recurring) return h;
        const d = new Date(h.date);
        // Date.UTC ile: sunucunun/istemcinin çalıştığı saat dilimi ne olursa
        // olsun, tarih doğru gün olarak sabit kalır (yerel new Date(y,m,d)
        // yerel gece yarısını kullanır, UTC'ye çevrilince bir gün kayabilir).
        return { ...h, date: new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate())) };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Bugünden itibaren gelecekteki resmi tatiller (bu yıl + gelecek yıl,
   * recurring olanlar ilgili yıla uyarlanmış hâlde), en yakından uzağa sıralı.
   */
  async upcomingHolidays(limit = 10) {
    const now = new Date();
    const thisYear = now.getFullYear();
    const [thisYearRows, nextYearRows] = await Promise.all([
      this.listHolidays(thisYear),
      this.listHolidays(thisYear + 1),
    ]);
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    return [...thisYearRows, ...nextYearRows]
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, limit);
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
        // Yarım gün de yıllık izin bakiyesinden düşer (0.5 gün); saatlik ise
        // İK tarafından hrGrantHourlyLeave() ile ayrı bir yoldan, bakiyeye
        // hiç dokunmadan tanımlanır (bkz. asağıda).
        affectsAnnualBalance: dto.type === LeaveType.ANNUAL || dto.type === LeaveType.HALF_DAY,
        isPaid: true,
      };
    }

    throw new BadRequestException('İzin türü veya kategori belirtilmelidir');
  }

  /**
   * İzin gün sayısı: başlangıç VE bitiş tarihi dahil, aralıktaki her gün için
   * hafta sonu (cumartesi/pazar) ve resmi tatiller hariç tutularak sayılır.
   * Örn. 23.07 (Per) -> 27.07 (Pzt) = 4 iş günü (25-26 hafta sonu hariç).
   */
  private async calculateBusinessDays(start: Date, end: Date): Promise<number> {
    const s = dayjs(start).startOf('day');
    const e = dayjs(end).startOf('day');

    const years = new Set<number>();
    for (let y = s.year(); y <= e.year(); y++) years.add(y);
    const holidayLists = await Promise.all([...years].map((y) => this.listHolidays(y)));
    const holidaySet = new Set(
      holidayLists.flat().map((h) => dayjs(h.date).format('YYYY-MM-DD')),
    );

    let count = 0;
    let cur = s;
    while (!cur.isAfter(e)) {
      const dow = cur.day(); // 0=Pazar .. 6=Cumartesi
      if (dow !== 0 && dow !== 6 && !holidaySet.has(cur.format('YYYY-MM-DD'))) {
        count++;
      }
      cur = cur.add(1, 'day');
    }
    return count;
  }
}
