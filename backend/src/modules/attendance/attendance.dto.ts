import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceMethod } from '@prisma/client';

export class CheckInDto {
  @ApiProperty({ enum: AttendanceMethod })
  @IsEnum(AttendanceMethod)
  method!: AttendanceMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class CheckOutDto {
  @ApiProperty({ enum: AttendanceMethod, required: false })
  @IsOptional()
  @IsEnum(AttendanceMethod)
  method?: AttendanceMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
