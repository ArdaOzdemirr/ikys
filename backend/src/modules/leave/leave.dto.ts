import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType, PaymentType } from '@prisma/client';

export class CreateLeaveRequestDto {
  // Yeni dinamik kategori sistemi: categoryId tercih edilir.
  @ApiProperty({ required: false, description: 'Dinamik izin kategorisi ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  // Geriye dönük uyumluluk: eski enum türü hâlâ kabul edilir.
  @ApiProperty({ enum: LeaveType, required: false })
  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false, description: 'Sağlık raporu vb. belge URL\'i' })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiProperty({
    required: false,
    enum: ['AM', 'PM'],
    description: 'Yarım gün izin seansı: AM=09:00-13:30, PM=13:30-18:00 (type=HALF_DAY iken zorunlu)',
  })
  @IsOptional()
  @IsEnum(['AM', 'PM'])
  halfDayPeriod?: 'AM' | 'PM';
}

export class CreateHourlyLeaveDto {
  @ApiProperty({ description: 'İzin verilecek personelin id\'si' })
  @IsString()
  personnelId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'HH:mm formatında, örn. 14:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ description: 'HH:mm formatında, örn. 16:00' })
  @IsString()
  endTime!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApproveLeaveDto {
  @ApiProperty()
  @IsBoolean()
  approved!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  // İlk yıl (kıdem < 1) izinlerinde onaylayan ücretli/ücretsiz kararı verir.
  @ApiProperty({ enum: PaymentType, required: false })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;
}
