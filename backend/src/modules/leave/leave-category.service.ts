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
@Injectable()
export class LeaveCategoryService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.leaveCategory.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { requests: true, accesses: true } } },
    });
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
