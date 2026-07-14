// Personel için CRUD işlemleri, işten çıkış işlemi (soft delete) ve organizasyon şeması için controller. Bu işlemleri Admin ve İnsan Kaynakları yapabilir. Organizasyon şeması tüm roller tarafından görüntülenebilir.

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PersonnelService } from './personnel.service';
import {
  CreatePersonnelDto,
  UpdatePersonnelDto,
  ResignDto,
  ListPersonnelDto,
  UpdateMyProfileDto,
  UpdateEmailDto,
} from './personnel.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, PersonnelStatus } from '@prisma/client';

@ApiTags('personnel')
@ApiBearerAuth()
@Controller('personnel')
export class PersonnelController {
  constructor(private readonly service: PersonnelService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Yeni personel ekle (Belge: FR-02)' })
  create(@Body() dto: CreatePersonnelDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  list(@Query() q: ListPersonnelDto) {
    return this.service.findAll({
      departmentId: q.departmentId,
      status: q.status as PersonnelStatus,
      search: q.search,
      page: q.page ? +q.page : 1,
      limit: q.limit ? +q.limit : 20,
    });
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Organizasyon şeması (otomatik hiyerarşi)' })
  orgChart() {
    return this.service.getOrgChart();
  }

  @Get('me')
  @ApiOperation({ summary: 'Kendi personel kaydım (profil)' })
  me(@CurrentUser('userId') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Kendi iletişim bilgilerimi güncelle' })
  updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.service.updateSelf(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  update(@Param('id') id: string, @Body() dto: UpdatePersonnelDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/email')
  @Roles(Role.HR)
  @ApiOperation({ summary: 'E-posta güncelle (sadece İK, kendi e-postası dahil)' })
  updateEmail(@Param('id') id: string, @Body() dto: UpdateEmailDto) {
    return this.service.updateEmail(id, dto);
  }

  @Patch(':id/resign')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'İşten çıkış işlemi (soft delete - kayıt kalır)' })
  resign(@Param('id') id: string, @Body() dto: ResignDto) {
    return this.service.resign(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Personeli kalıcı olarak sil (sadece ADMIN, tüm ilişkili veriler silinir)',
  })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
