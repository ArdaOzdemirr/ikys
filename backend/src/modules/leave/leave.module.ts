import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveCategoryController } from './leave-category.controller';
import { LeaveCategoryService } from './leave-category.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeaveController, LeaveCategoryController],
  providers: [LeaveService, LeaveCategoryService],
})
export class LeaveModule {}
