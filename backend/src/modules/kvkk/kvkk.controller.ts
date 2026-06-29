import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KvkkService } from './kvkk.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('kvkk')
@ApiBearerAuth()
@Controller('kvkk')
export class KvkkController {
  constructor(private readonly service: KvkkService) {}

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Audit log sorgu (Belge: kim, neyi, ne zaman)' })
  query(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.queryLogs({
      userId, entity, action, startDate, endDate,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    });
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.HR)
  stats() { return this.service.stats(); }

  // Veri saklama politikası
  @Post('retention-policy')
  @Roles(Role.ADMIN)
  setPolicy(@Body() body: { entity: string; retentionDays: number; anonymizeAfter?: boolean }) {
    return this.service.setRetentionPolicy(body.entity, body.retentionDays, body.anonymizeAfter);
  }

  @Get('retention-policy')
  @Roles(Role.ADMIN, Role.HR)
  listPolicies() { return this.service.listRetentionPolicies(); }

  // KVKK Onayları
  @Post('consent')
  recordConsent(@Body() body: any) {
    return this.service.recordConsent(body.personnelId, body.consentType, body.granted);
  }

  @Get('consent/:personnelId')
  @Roles(Role.ADMIN, Role.HR)
  getConsents(@Param('personnelId') personnelId: string) {
    return this.service.getConsents(personnelId);
  }

  // Anonimleştirme (KVKK silme hakkı)
  @Post('anonymize/:personnelId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Personeli anonimleştir (KVKK uyarınca silme/anonimleştirme)' })
  anonymize(@Param('personnelId') personnelId: string) {
    return this.service.anonymizePersonnel(personnelId);
  }
}
