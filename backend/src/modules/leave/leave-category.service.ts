import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateLeaveCategoryDto,
  UpdateLeaveCategoryDto,
} from './leave-category.dto';

/**
 * HR/Admin tarafından izin kategorilerinin yönetimi.
 * - Yeni kategori açma, düzenleme, pasifleştirme
 * - Kategori görünürlüğünü kişiye özel açma/gizleme
 */
// Sistemin yerleşik (enum tabanlı) izin türleri: gerçek talepler bugün hâlâ
// bunlar üzerinden çalışıyor (dinamik kategori tablosu boş). "İzin
// Kategorileri" sayfasında görünsünler diye salt-okunur satırlar olarak
// gösteriliyor — düzenleme/silme yapılamaz, gerçek DB kaydı değiller.
const SYSTEM_LEAVE_TYPES: Array<{
  code: string;
  name: string;
  isPaid: boolean;
  affectsAnnualBalance: boolean;
}> = [
  { code: 'ANNUAL', name: 'Yıllık İzin', isPaid: true, affectsAnnualBalance: true },
  { code: 'HALF_DAY', name: 'Yarım Gün İzin', isPaid: true, affectsAnnualBalance: true },
  { code: 'HOURLY', name: 'Saatlik İzin', isPaid: true, affectsAnnualBalance: false },
  { code: 'EXCUSE', name: 'Mazeret İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'SICK', name: 'Sağlık Raporu', isPaid: true, affectsAnnualBalance: false },
  { code: 'MATERNITY', name: 'Doğum İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'PATERNITY', name: 'Babalık İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'MARRIAGE', name: 'Evlilik İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'BEREAVEMENT', name: 'Vefat İzni', isPaid: true, affectsAnnualBalance: false },
  { code: 'UNPAID', name: 'Ücretsiz İzin', isPaid: false, affectsAnnualBalance: false },
];

@Injectable()
export class LeaveCategoryService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const real = await this.prisma.leaveCategory.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { requests: true, accesses: true } } },
    });
    const realCodes = new Set(real.map((c) => c.code));
    const synthetic = SYSTEM_LEAVE_TYPES.filter((t) => !realCodes.has(t.code)).map((t) => ({
      id: `system:${t.code}`,
      code: t.code,
      name: t.name,
      description: null,
      isPaid: t.isPaid,
      affectsAnnualBalance: t.affectsAnnualBalance,
      defaultVisible: true,
      isActive: true,
      isSystem: true,
      readOnly: true,
      _count: { requests: 0, accesses: 0 },
    }));
    return [...synthetic, ...real];
  }

  async create(dto: CreateLeaveCategoryDto, creatorPersonnelId?: string) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    const exists = await this.prisma.leaveCategory.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Bu kod zaten kullanılıyor');

    return this.prisma.leaveCategory.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        isPaid: dto.isPaid ?? true,
        affectsAnnualBalance: dto.affectsAnnualBalance ?? false,
        defaultVisible: dto.defaultVisible ?? true,
        isSystem: false,
        createdById: creatorPersonnelId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateLeaveCategoryDto) {
    const cat = await this.prisma.leaveCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');

    // Sistem kategorilerinde kodu değiştirmeye izin verme
    const data: any = { ...dto };
    if (cat.isSystem) delete data.code;
    else if (data.code) data.code = data.code.trim().toUpperCase().replace(/\s+/g, '_');

    return this.prisma.leaveCategory.update({ where: { id }, data });
  }

  async remove(id: string) {
    const cat = await this.prisma.leaveCategory.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');
    if (cat.isSystem) {
      throw new BadRequestException('Sistem kategorisi silinemez (pasifleştirebilirsiniz)');
    }
    // Talep bağlıysa silme, pasifleştir
    if (cat._count.requests > 0) {
      return this.prisma.leaveCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.leaveCategory.delete({ where: { id } });
  }

  /** Kategori görünürlüğünü bir kişi için açar/gizler (upsert) */
  async setVisibility(categoryId: string, personnelId: string, visible: boolean) {
    const cat = await this.prisma.leaveCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');

    return this.prisma.leaveCategoryAccess.upsert({
      where: { categoryId_personnelId: { categoryId, personnelId } },
      update: { visible },
      create: { categoryId, personnelId, visible },
    });
  }

  /** Kişiye özel istisnayı kaldırır (kategori varsayılan görünürlüğüne döner) */
  async clearVisibility(categoryId: string, personnelId: string) {
    await this.prisma.leaveCategoryAccess
      .delete({ where: { categoryId_personnelId: { categoryId, personnelId } } })
      .catch(() => null);
    return { success: true };
  }

  /** Bir kategorinin kişiye özel istisnaları */
  listVisibility(categoryId: string) {
    return this.prisma.leaveCategoryAccess.findMany({
      where: { categoryId },
      include: {
        personnel: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      },
    });
  }
}
