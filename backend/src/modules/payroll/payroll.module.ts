import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCalculator } from './payroll.calculator';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollCalculator],
})
export class PayrollModule {}
