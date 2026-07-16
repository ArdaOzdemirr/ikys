import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { ApproveLeaveDto, CreateLeaveRequestDto } from './leave.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('requests')
  @ApiOperation({ summary: 'Yeni izin talebi oluştur (Belge: FR-03)' })
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateLeaveRequestDto) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.createRequest(personnel.id, dto);
  }

  @Get('requests/me')
  async myRequests(@CurrentUser('userId') userId: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.myRequests(personnel.id);
  }

  @Get('requests/pending')
  @Roles(Role.MANAGER, Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Onay bekleyen talepler (Belge: FR-04)' })
  async pending(@CurrentUser('userId') userId: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.pendingForManager(personnel.id);
  }

  @Patch('requests/:id/approve')
  @Roles(Role.MANAGER, Role.HR, Role.ADMIN)
  async approve(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.approve(id, personnel.id, dto, role);
  }

  @Delete('requests/:id')
  @ApiOperation({ summary: 'Henüz onaylanmamış (PENDING) kendi talebini geri çek' })
  async cancel(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.cancel(id, personnel.id);
  }

  @Post('requests/:id/request-cancellation')
  @ApiOperation({ summary: 'Onaylı izin için amir onayı gerektiren iptal talebi oluştur' })
  async requestCancellation(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.requestCancellation(id, personnel.id);
  }

  @Get('requests/pending-cancellations')
  @Roles(Role.MANAGER, Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Onayını bekleyen izin iptal talepleri' })
  async pendingCancellations(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.pendingCancellations(personnel.id, role);
  }

  @Patch('requests/:id/cancellation-decision')
  @Roles(Role.MANAGER, Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'İzin iptal talebini onayla/reddet' })
  async decideCancellation(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.decideCancellation(id, personnel.id, dto.approved, role, dto.rejectionReason);
  }

  @Delete('requests/:id/remove')
  @ApiOperation({ summary: 'İzin talebini kalıcı sil (sahibi veya HR/Admin)' })
  async remove(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.remove(id, personnel.id, role);
  }

  @Get('balance/me')
  async myBalance(
    @CurrentUser('userId') userId: string,
    @Query('year') year?: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.myBalance(personnel.id, year ? +year : undefined);
  }

  @Get('balance/all')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Tüm personelin yıllık izin hakedişi/kullanımı (sadece İK/Admin)' })
  allBalances() {
    return this.service.allAnnualBalances();
  }

  @Get('list/personnel')
  @Roles(Role.MANAGER, Role.HR, Role.ACCOUNTING, Role.ADMIN)
  @ApiOperation({ summary: 'İzin Listesi\'nde seçilebilecek personel (role/hiyerarşiye göre)' })
  async leaveListPersonnel(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.leaveListPersonnel(personnel.id, role);
  }

  @Get('list')
  @Roles(Role.MANAGER, Role.HR, Role.ACCOUNTING, Role.ADMIN)
  @ApiOperation({ summary: 'İzin listesi (role ve hiyerarşiye göre filtrelenir)' })
  async list(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.leaveList(personnel.id, role, {
      status,
      year: year ? +year : undefined,
    });
  }

  // Tatiller
  @Get('holidays')
  holidays(@Query('year') year?: string) {
    return this.service.listHolidays(year ? +year : undefined);
  }

  @Post('holidays')
  @Roles(Role.HR, Role.ADMIN)
  createHoliday(@Body() body: any) {
    return this.service.createHoliday(body);
  }

  @Delete('holidays/:id')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Resmi tatili sil' })
  removeHoliday(@Param('id') id: string) {
    return this.service.removeHoliday(id);
  }
}
