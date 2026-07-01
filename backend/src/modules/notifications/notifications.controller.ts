import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendMessageDto, BroadcastDto, DeviceTokenDto } from './notifications.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  private async me(userId: string) {
    const personnel = await this.prisma.personnel.findUnique({
      where: { userId },
    });
    if (!personnel) throw new NotFoundException('Personel kaydı bulunamadı');
    return personnel;
  }

  @Get()
  @ApiOperation({ summary: 'Gelen kutusu (en yeni önce)' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query('unread') unread?: string,
  ) {
    const p = await this.me(userId);
    return this.service.list(p.id, unread === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('userId') userId: string) {
    const p = await this.me(userId);
    return this.service.unreadCount(p.id);
  }

  @Get('recipients')
  @ApiOperation({ summary: 'Mesaj gönderebileceğim kişiler (kendi seviyem ve altım, üst hiyerarşi hariç)' })
  async recipients(@CurrentUser('userId') userId: string) {
    const p = await this.me(userId);
    return this.service.messageableRecipients(p.id);
  }

  @Post('message')
  @ApiOperation({ summary: 'Aynı seviyedeki veya alt kademedeki personele mesaj gönder' })
  async send(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    const p = await this.me(userId);
    return this.service.sendMessage(p.id, dto.recipientIds, dto.title, dto.body, dto.priority);
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Tüm personele toplu duyuru gönderir (bildirim + e-posta + push)' })
  async broadcast(
    @CurrentUser('userId') userId: string,
    @Body() dto: BroadcastDto,
  ) {
    const p = await this.me(userId);
    return this.service.broadcast(p.id, dto.title, dto.body, dto.priority);
  }

  @Post('device-token')
  @ApiOperation({ summary: 'FCM cihaz token kaydet (mobil)' })
  async registerDeviceToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: DeviceTokenDto,
  ) {
    const p = await this.me(userId);
    return this.service.registerDeviceToken(p.id, dto.token, dto.platform);
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'FCM cihaz token sil (çıkışta)' })
  removeDeviceToken(@Body() dto: DeviceTokenDto) {
    return this.service.removeDeviceToken(dto.token);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const p = await this.me(userId);
    return this.service.markRead(id, p.id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser('userId') userId: string) {
    const p = await this.me(userId);
    return this.service.markAllRead(p.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bildirimi sil' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const p = await this.me(userId);
    return this.service.remove(id, p.id);
  }
}
