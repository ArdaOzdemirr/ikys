import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Belge: KVKK & Loglama
 * - Kim, neyi, ne zaman görüntüledi/değiştirdi (audit log)
 * - Hassas veriler için erişim sınırı
 * - Personel verisinin arşivi
 * - Veri Saklama Süresi Politikası
 * - Anonimleştirme / Silme Mekanizması
 */
@Injectable()
export class KvkkService {
  private readonly logger = new Logger(KvkkService.name);

  constructor(private prisma: PrismaService) {}

  // ============= AUDIT LOG SORGU =============
  queryLogs(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, entity, action, startDate, endDate, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, role: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({ data, total, page, limit }));
  }

  // ============= VERİ SAKLAMA POLİTİKASI =============
  setRetentionPolicy(entity: string, retentionDays: number, anonymizeAfter = true) {
    return this.prisma.dataRetentionPolicy.upsert({
      where: { entity },
      create: { entity, retentionDays, anonymizeAfter },
      update: { retentionDays, anonymizeAfter },
    });
  }

  listRetentionPolicies() {
    return this.prisma.dataRetentionPolicy.findMany();
  }

  // ============= KVKK ONAYLARI =============
  recordConsent(personnelId: string, consentType: string, granted: boolean, ipAddress?: string) {
    return this.prisma.kvkkConsent.create({
      data: { personnelId, consentType, granted, ipAddress },
    });
  }

  getConsents(personnelId: string) {
    return this.prisma.kvkkConsent.findMany({
      where: { personnelId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * Belge: "Anonimleştirme / Silme Mekanizması"
   * Belirli bir personelin hassas verilerini anonimleştirir.
   * (Örn. işten ayrılalı X yıl olmuş personeller için)
   */
  async anonymizePersonnel(personnelId: string) {
    const fakeId = `ANON-${Date.now()}`;
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.personnel.findUnique({ where: { id: personnelId } });
      if (!p) return null;

      // KVKK uyarınca: TCKN, ad-soyad, adres, telefon, kimlik bilgilerini anonimize et
      await tx.personnel.update({
        where: { id: personnelId },
        data: {
          firstName: 'ANONIM',
          lastName: fakeId,
          tcKimlikNo: fakeId.substring(0, 11).padEnd(11, '0'),
          phone: null,
          address: null,
          emergencyContact: null,
          birthDate: null,
        },
      });

      // Belgelerini sil
      await tx.document.deleteMany({ where: { personnelId } });

      // User e-postasını anonimize et
      await tx.user.update({
        where: { id: p.userId },
        data: { email: `${fakeId}@anonim.local`, isActive: false },
      });

      this.logger.warn(`Personnel ${personnelId} anonimleştirildi`);
      return { success: true, anonymizedAs: fakeId };
    });
  }

  /**
   * Otomatik veri saklama temizliği - her gece 03:00
   * Belge: "Veri Saklama Süresi Politikası"
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runRetentionCleanup() {
    this.logger.log('🧹 KVKK veri saklama politikası kontrolü başladı');
    const policies = await this.prisma.dataRetentionPolicy.findMany();

    for (const policy of policies) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - policy.retentionDays);

      if (policy.entity === 'AuditLog') {
        const result = await this.prisma.auditLog.deleteMany({
          where: { timestamp: { lt: cutoff } },
        });
        this.logger.log(`AuditLog: ${result.count} kayıt silindi`);
      }

      // İstifa eden personeller için anonimleştirme
      if (policy.entity === 'Personnel' && policy.anonymizeAfter) {
        const oldResigned = await this.prisma.personnel.findMany({
          where: {
            status: 'RESIGNED',
            resignDate: { lt: cutoff },
            firstName: { not: 'ANONIM' },
          },
          select: { id: true },
        });
        for (const p of oldResigned) {
          await this.anonymizePersonnel(p.id);
        }
        if (oldResigned.length) {
          this.logger.log(`Personnel: ${oldResigned.length} kayıt anonimleştirildi`);
        }
      }
    }
  }

  // ============= İSTATİSTİK =============
  async stats() {
    const [totalLogs, totalUsers, last24h] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.auditLog.count({
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { totalLogs, totalUsers, last24hActions: last24h };
  }
}
