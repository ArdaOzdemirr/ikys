import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { PushService } from './push.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MailerService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
