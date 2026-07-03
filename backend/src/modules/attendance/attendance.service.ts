import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AttendanceMethod } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CheckInDto, CheckOutDto } from './attendance.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

// Sunucu (Railway) UTC'de çalışıyor; mesai saatleri ve "bugün" her zaman
// Türkiye saatine göre hesaplanmalı, yoksa geç kalma/gün sınırı yanlış çıkar.
const TZ = 'Europe/Istanbul';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private todayInTurkey(): Date {
    const d = dayjs().tz(TZ);
    return new Date(Date.UTC(d.year(), d.month(), d.date()));
  }

  async generateQrCode(branchId?: string) {
    // Sabit QR: süresi yok denecek kadar uzak bir tarih (rotasyon yok)
    const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.qrCode.findFirst({
      where: { branchId: branchId ?? null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.validUntil < new Date()) {
        return this.prisma.qrCode.update({
          where: { id: existing.id },
          data: { validUntil: farFuture },
        });
      }
      return existing;
    }

    const code = uuid();
    return this.prisma.qrCode.create({
      data: { code, branchId, validUntil: farFuture },
    });
  }

  async checkIn(personnelId: string, dto: CheckInDto) {
    if (dto.method === AttendanceMethod.QR_CODE) {
      if (!dto.qrCode) throw new BadRequestException('QR kodu gerekli');
      const qr = await this.prisma.qrCode.findUnique({ where: { code: dto.qrCode } });
      if (!qr || qr.validUntil < new Date()) {
        throw new BadRequestException('QR kodu geçersiz veya süresi dolmuş');
      }
    }

    const today = this.todayInTurkey();

    const existing = await this.prisma.attendance.findUnique({
      where: { personnelId_date: { personnelId, date: today } },
    });
    if (existing && existing.checkIn) {
      throw new BadRequestException('Bugün zaten giriş yapmışsınız');
    }

    const shift = await this.prisma.shiftAssignment.findFirst({
      where: {
        personnelId,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { shift: true },
    });

    let isLate = false;
    if (shift) {
      const [hh, mm] = shift.shift.startTime.split(':').map(Number);
      const nowTr = dayjs().tz(TZ);
      const expectedStart = nowTr.hour(hh).minute(mm).second(0).millisecond(0);
      isLate = nowTr.isAfter(expectedStart.add(15, 'minute')); // 15dk tolerans
    }

    return this.prisma.attendance.upsert({
      where: { personnelId_date: { personnelId, date: today } },
      create: {
        personnelId,
        date: today,
        checkIn: new Date(),
        method: dto.method,
        checkInLat: dto.latitude,
        checkInLng: dto.longitude,
        isLate,
      },
      update: {
        checkIn: new Date(),
        method: dto.method,
        checkInLat: dto.latitude,
        checkInLng: dto.longitude,
        isLate,
      },
    });
  }

  async checkOut(personnelId: string, dto: CheckOutDto) {
    if (dto.method === AttendanceMethod.QR_CODE) {
      if (!dto.qrCode) throw new BadRequestException('QR kodu gerekli');
      const qr = await this.prisma.qrCode.findUnique({ where: { code: dto.qrCode } });
      if (!qr || qr.validUntil < new Date()) {
        throw new BadRequestException('QR kodu geçersiz veya süresi dolmuş');
      }
    }

    const today = this.todayInTurkey();

    const att = await this.prisma.attendance.findUnique({
      where: { personnelId_date: { personnelId, date: today } },
    });
    if (!att || !att.checkIn) {
      throw new BadRequestException('Önce giriş yapmalısınız');
    }
    if (att.checkOut) {
      throw new BadRequestException('Bugün zaten çıkış yapmışsınız');
    }

    const checkOut = new Date();
    const workedMinutes = dayjs(checkOut).diff(att.checkIn, 'minute');

    const shift = await this.prisma.shiftAssignment.findFirst({
      where: {
        personnelId,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { shift: true },
    });

    let overtimeMin = 0;
    if (shift) {
      const standardMinutes = this.calculateShiftMinutes(
        shift.shift.startTime,
        shift.shift.endTime,
        shift.shift.breakMin,
      );
      overtimeMin = Math.max(0, workedMinutes - standardMinutes);
    }

    return this.prisma.attendance.update({
      where: { id: att.id },
      data: {
        checkOut,
        checkOutLat: dto.latitude,
        checkOutLng: dto.longitude,
        workedMinutes,
        overtimeMin,
      },
    });
  }

  async myAttendance(personnelId: string, startDate?: string, endDate?: string) {
    const where: any = { personnelId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    return this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * İK/Admin için: bir günde tüm aktif personelin giriş/çıkış durumu
   * (kaydı olmayanlar "henüz giriş yapmadı" olarak döner).
   */
  async allForDate(dateStr?: string) {
    let normalized: Date;
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      normalized = new Date(Date.UTC(y, m - 1, d));
    } else {
      normalized = this.todayInTurkey();
    }

    const [personnel, records] = await Promise.all([
      this.prisma.personnel.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
        orderBy: [{ firstName: 'asc' }],
      }),
      this.prisma.attendance.findMany({ where: { date: normalized } }),
    ]);

    const byPersonnel = new Map(records.map((r) => [r.personnelId, r]));

    return personnel.map((p) => {
      const r = byPersonnel.get(p.id);
      return {
        personnelId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        employeeNo: p.employeeNo,
        department: p.department?.name ?? null,
        checkIn: r?.checkIn ?? null,
        checkOut: r?.checkOut ?? null,
        isLate: r?.isLate ?? false,
        workedMinutes: r?.workedMinutes ?? null,
      };
    });
  }

  /**
   * Belge: "Günlük/aylık çalışma saatleri"
   */
  async monthlyReport(personnelId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const records = await this.prisma.attendance.findMany({
      where: { personnelId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    const totalWorkedMin = records.reduce((s, r) => s + (r.workedMinutes || 0), 0);
    const totalOvertimeMin = records.reduce((s, r) => s + r.overtimeMin, 0);
    const lateDays = records.filter((r) => r.isLate).length;

    return {
      personnelId,
      year,
      month,
      totalWorkedHours: +(totalWorkedMin / 60).toFixed(2),
      totalOvertimeHours: +(totalOvertimeMin / 60).toFixed(2),
      lateDays,
      workingDays: records.length,
      records,
    };
  }

  // === Helpers ===
  private calculateShiftMinutes(startTime: string, endTime: string, breakMin: number) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    return total - breakMin;
  }
}

