import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreatePersonnelDto, UpdatePersonnelDto, ResignDto, UpdateEmailDto } from './personnel.dto';
import { PersonnelStatus, Role } from '@prisma/client';
import { cumulativeAnnualLeaveEntitlement } from '../leave/leave-entitlement.util';

@Injectable()
export class PersonnelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePersonnelDto) {
    // TCKN benzersizlik kontrolü
    const existing = await this.prisma.personnel.findUnique({
      where: { tcKimlikNo: dto.tcKimlikNo },
    });
    if (existing) throw new ConflictException('Bu TCKN ile kayıtlı personel mevcut');

    const passwordHash = await bcrypt.hash(dto.password || 'Degistir123!', 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role || Role.EMPLOYEE,
        },
      });

      const personnel = await tx.personnel.create({
        data: {
          employeeNo: dto.employeeNo,
          userId: user.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          tcKimlikNo: dto.tcKimlikNo,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          phone: dto.phone,
          address: dto.address,
          emergencyContact: dto.emergencyContact,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          managerId: dto.managerId,
          contractType: dto.contractType,
          hireDate: new Date(dto.hireDate),
          contractStart: dto.contractStart ? new Date(dto.contractStart) : null,
          contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : null,
        },
        include: { user: true, department: true, position: true },
      });

      // İzin bakiyesi otomatik hesapla (Belge: Hakediş Hesaplama - kıdeme göre).
      // Bu satır sadece kayıt amaçlıdır; gerçek hak ediş her zaman canlı
      // hesaplanır (bkz. leave.service.ts -> annualLeaveSummary), hiç sıfırlanmaz.
      const annualLeaveDays = cumulativeAnnualLeaveEntitlement(personnel.hireDate);

      await tx.leaveBalance.create({
        data: {
          personnelId: personnel.id,
          year: new Date().getFullYear(),
          type: 'ANNUAL',
          totalDays: annualLeaveDays,
          remainingDays: annualLeaveDays,
        },
      });

      return personnel;
    });
  }

  async findAll(filters: {
    departmentId?: string;
    status?: PersonnelStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { departmentId, status, search, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.personnel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { email: true, role: true, lastLoginAt: true } },
          department: true,
          position: true,
          manager: { select: { firstName: true, lastName: true } },
        },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.personnel.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Giriş yapan kullanıcının kendi personel kaydı (mobil/web profil için). */
  async findByUserId(userId: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, role: true, twoFactorEnabled: true } },
        department: { select: { name: true } },
        position: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return personnel;
  }

  /** Kullanıcı yalnızca kendi iletişim bilgilerini günceller (ad/TCKN/maaş değişmez). */
  async updateSelf(
    userId: string,
    data: { phone?: string; address?: string; emergencyContact?: string },
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.prisma.personnel.update({
      where: { userId },
      data: {
        phone: data.phone,
        address: data.address,
        emergencyContact: data.emergencyContact,
      },
      include: {
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
    });
  }

  async findOne(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true, twoFactorEnabled: true } },
        department: true,
        position: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        documents: true,
        salaryConfig: true,
      },
    });
    if (!personnel) throw new NotFoundException('Personel bulunamadı');

    // KVKK: TCKN'yi maskele (tam veriye sadece HR/Admin erişir - controller'da rol kontrolü)
    return personnel;
  }

  /** Sadece İK'nın (kendi e-postası dahil) çağırabileceği, ayrı bir uç nokta. */
  async updateEmail(id: string, dto: UpdateEmailDto) {
    const personnel = await this.findOne(id);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && existing.id !== personnel.userId) {
      throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');
    }
    await this.prisma.user.update({
      where: { id: personnel.userId },
      data: { email: dto.email },
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdatePersonnelDto) {
    await this.findOne(id);
    return this.prisma.personnel.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        contractStart: dto.contractStart ? new Date(dto.contractStart) : undefined,
        contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : undefined,
      },
    });
  }

  async resign(id: string, dto: ResignDto) {
    return this.prisma.personnel.update({
      where: { id },
      data: {
        status: PersonnelStatus.RESIGNED,
        resignDate: new Date(dto.resignDate),
        resignReason: dto.resignReason,
      },
    });
  }

  /**
   * Kalıcı silme - DB'den tamamen kaldırır.
   * KVKK uyumu için soft delete (resign) tercih edilmeli;
   * bu yöntem sadece test/hatalı kayıt temizliği için.
   */
  async remove(id: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!personnel) throw new NotFoundException('Personel bulunamadı');

    return this.prisma.$transaction(async (tx) => {
      // İlişkili kayıtları sil (cascade)
      await tx.attendance.deleteMany({ where: { personnelId: id } });
      await tx.leaveRequest.deleteMany({ where: { personnelId: id } });
      await tx.leaveBalance.deleteMany({ where: { personnelId: id } });
      await tx.payroll.deleteMany({ where: { personnelId: id } });
      await tx.expense.deleteMany({ where: { personnelId: id } });
      await tx.document.deleteMany({ where: { personnelId: id } });
      await tx.salaryConfig.deleteMany({ where: { personnelId: id } });
      await tx.shiftAssignment.deleteMany({ where: { personnelId: id } });
      await tx.kvkkConsent.deleteMany({ where: { personnelId: id } });

      // Yönetici olarak gözüktüğü personellerin manager bağını kaldır
      await tx.personnel.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });

      // Bildirimler ve başkalarının taleplerinde onaylayan olduğu adımlar
      await tx.leaveApprovalStep.deleteMany({ where: { approverId: id } });
      await tx.notification.deleteMany({
        where: { OR: [{ recipientId: id }, { senderId: id }] },
      });

      // Personel kaydını sil
      await tx.personnel.delete({ where: { id } });

      // Bağlı user kaydını da sil (refresh tokenları ve audit loglar dahil)
      await tx.refreshToken.deleteMany({ where: { userId: personnel.userId } });
      await tx.user.delete({ where: { id: personnel.userId } });

      return { success: true, message: 'Personel kalıcı olarak silindi' };
    });
  }

  // Belge: Otomatik hiyerarşi şeması oluşturulmalı
  
  async getOrgChart() {
    const all = await this.prisma.personnel.findMany({
      where: { status: PersonnelStatus.ACTIVE },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        managerId: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    // Ağaç yapısına çevir
    const map = new Map(all.map((p) => [p.id, { ...p, children: [] as any[] }]));
    const roots: any[] = [];
    for (const node of map.values()) {
      if (node.managerId && map.has(node.managerId)) {
        map.get(node.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

}
