import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './config/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { KvkkModule } from './modules/kvkk/kvkk.module';
import { CompanyModule } from './modules/company/company.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      // Belge: Yetkisiz erişimlere karşı güvenlik (FNR)
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CompanyModule,
    PersonnelModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    RecruitmentModule,
    KvkkModule,
    NotificationsModule,
  ],
  providers: [
    // Tüm istekleri logla (Belge: KVKK audit log)
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
