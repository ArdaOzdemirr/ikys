import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto } from './attendance.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  // Dinamik QR kod oluşturuyor
  @Get('qr-code')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Dinamik QR kod oluştur (30 sn geçerli)' })
  qr(@Query('branchId') branchId?: string) {
    return this.service.generateQrCode(branchId);
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Giriş yap (QR/Kart/Remote)' })
  async checkIn(@CurrentUser('userId') userId: string, @Body() dto: CheckInDto) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.checkIn(personnel.id, dto);
  }

  @Post('check-out')
  async checkOut(@CurrentUser('userId') userId: string, @Body() dto: CheckOutDto) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.checkOut(personnel.id, dto);
  }

  @Get('me')
  async myAttendance(
    @CurrentUser('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId } });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return this.service.myAttendance(personnel.id, startDate, endDate);
  }

  @Get(':personnelId/monthly')
  @Roles(Role.ADMIN, Role.HR, Role.MANAGER)
  monthly(
    @Param('personnelId') personnelId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.monthlyReport(personnelId, +year, +month);
  }
}
