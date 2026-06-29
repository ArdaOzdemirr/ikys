import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateLeaveCategoryDto {
  @ApiProperty({ description: 'Benzersiz kod, ör. DOGUM_GUNU' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: true, description: 'Ücretli mi' })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Yıllık bakiyeden düşer mi' })
  @IsOptional()
  @IsBoolean()
  affectsAnnualBalance?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Varsayılan herkese açık mı' })
  @IsOptional()
  @IsBoolean()
  defaultVisible?: boolean;
}

export class UpdateLeaveCategoryDto extends PartialType(CreateLeaveCategoryDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetVisibilityDto {
  @ApiProperty()
  @IsString()
  personnelId!: string;

  @ApiProperty({ description: 'true = bu kişiye açık, false = gizli' })
  @IsBoolean()
  visible!: boolean;
}
