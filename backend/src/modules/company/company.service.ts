import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  //ŞUBELER
  createBranch(data: any) {
    return this.prisma.branch.create({ data });
  }
  listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      include: { departments: true },
    });
  }
  updateBranch(id: string, data: any) {
    return this.prisma.branch.update({ where: { id }, data });
  }
  async deleteBranch(id: string) {
    // Şubeye bağlı departman varsa ConflictException atıp engelliyor yoksa isActive = false yaparak siliyoruz
    const deptCount = await this.prisma.department.count({
      where: { branchId: id, isActive: true },
    });
    if (deptCount > 0) {
      throw new ConflictException(
        `Bu şubede ${deptCount} aktif departman var. Önce departmanları başka şubeye taşıyın veya silin.`,
      );
    }
    // Soft delete: isActive = false
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  //DEPARTMANLAR
  createDepartment(data: any) {
    return this.prisma.department.create({ data });
  }
  listDepartments(branchId?: string) {
    return this.prisma.department.findMany({
      where: { isActive: true, ...(branchId && { branchId }) },
      include: { positions: true, parent: true, _count: { select: { personnel: true } } },
    });
  }
  updateDepartment(id: string, data: any) {
    return this.prisma.department.update({ where: { id }, data });
  }
  async deleteDepartment(id: string) {
    // bağlı personel aktif pozisyonlar alt departman varsa engelliyor yoksa siliyor
    const [personnelCount, positionCount, childCount] = await Promise.all([
      this.prisma.personnel.count({ where: { departmentId: id } }),
      this.prisma.position.count({ where: { departmentId: id, isActive: true } }),
      this.prisma.department.count({ where: { parentId: id, isActive: true } }),
    ]);
    if (personnelCount > 0) {
      throw new ConflictException(`Bu departmana bağlı ${personnelCount} personel var.`);
    }
    if (positionCount > 0) {
      throw new ConflictException(`Bu departmana bağlı ${positionCount} aktif pozisyon var.`);
    }
    if (childCount > 0) {
      throw new ConflictException(`Bu departmanın ${childCount} alt departmanı var.`);
    }
    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  //POZİSYONLAR
  createPosition(data: any) {
    return this.prisma.position.create({ data });
  }
  listPositions(departmentId?: string) {
    return this.prisma.position.findMany({
      where: { isActive: true, ...(departmentId && { departmentId }) },
      include: { department: true, _count: { select: { personnel: true } } },
    });
  }
  updatePosition(id: string, data: any) {
    return this.prisma.position.update({ where: { id }, data });
  }

  // Pozisyona bağlı personel varsa engelliyor yoksa siliyor.
  async deletePosition(id: string) {
    const personnelCount = await this.prisma.personnel.count({
      where: { positionId: id },
    });
    if (personnelCount > 0) {
      throw new ConflictException(`Bu pozisyona bağlı ${personnelCount} personel var.`);
    }
    return this.prisma.position.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
