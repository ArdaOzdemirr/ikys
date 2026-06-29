import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LeaveCategoryService } from './leave-category.service';
import { LeaveService } from './leave.service';
import {
  CreateLeaveCategoryDto,
  UpdateLeaveCategoryDto,
  SetVisibilityDto,
} from './leave-category.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('leave-categories')
@ApiBearerAuth()
@Controller('leave/categories')
export class LeaveCategoryController {
  constructor(
    private readonly service: LeaveCategoryService,
    private readonly leaveService: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  /** Çalışanın seçebileceği (kendisine açık) kategoriler */
  @Get('me')
  @ApiOperation({ summary: 'Bana açık izin kategorileri' })
  async forMe(@CurrentUser('userId') userId: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new Error('Personel kaydı bulunamadı');
    return this.leaveService.availableCategories(personnel.id);
  }

  // ===== HR / Admin yönetimi =====
  @Get()
  @Roles(Role.HR, Role.ADMIN)
  list() {
    return this.service.list();
  }

  @Post()
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Yeni izin kategorisi aç' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveCategoryDto,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    return this.service.create(dto, personnel?.id);
  }

  @Patch(':id')
  @Roles(Role.HR, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLeaveCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.HR, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ===== Kişiye özel görünürlük =====
  @Get(':id/visibility')
  @Roles(Role.HR, Role.ADMIN)
  listVisibility(@Param('id') id: string) {
    return this.service.listVisibility(id);
  }

  @Put(':id/visibility')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Kategoriyi bir kişiye aç/gizle' })
  setVisibility(@Param('id') id: string, @Body() dto: SetVisibilityDto) {
    return this.service.setVisibility(id, dto.personnelId, dto.visible);
  }

  @Delete(':id/visibility/:personnelId')
  @Roles(Role.HR, Role.ADMIN)
  clearVisibility(
    @Param('id') id: string,
    @Param('personnelId') personnelId: string,
  ) {
    return this.service.clearVisibility(id, personnelId);
  }
}
