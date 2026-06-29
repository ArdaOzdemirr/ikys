import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationPriority } from '@prisma/client';

/**
 * Kişiden kişiye serbest mesaj gönderme.
 * Alıcılar yalnızca gönderenin kendi seviyesi (aynı amire bağlı) veya
 * bir alt seviyesindeki (kendi astı olan) personeller olabilir.
 */
export class SendMessageDto {
  @ApiProperty({ type: [String], description: 'Alıcı personel ID listesi' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recipientIds!: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiProperty({ required: false, enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
}

export class BroadcastDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiProperty({ required: false, enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
}

export class DeviceTokenDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  platform?: string;
}
