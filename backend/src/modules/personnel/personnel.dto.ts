import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ContractType, PersonnelStatus, Role } from '@prisma/client';

export class CreatePersonnelDto {
  @ApiProperty()
  @IsString()
  employeeNo!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false, minLength: 8 })
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({ enum: Role, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ description: '11 haneli TCKN' })
  @Length(11, 11)
  @Matches(/^[1-9][0-9]{10}$/, { message: 'Geçerli bir TCKN giriniz' })
  tcKimlikNo!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ enum: ContractType, default: ContractType.PERMANENT })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @ApiProperty()
  @IsDateString()
  hireDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  contractStart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  contractEnd?: string;
}

export class UpdatePersonnelDto extends PartialType(CreatePersonnelDto) {}

export class ResignDto {
  @ApiProperty()
  @IsDateString()
  resignDate!: string;

  @ApiProperty()
  @IsString()
  resignReason!: string;
}

export class ListPersonnelDto {
  @ApiProperty({ required: false }) @IsOptional() departmentId?: string;
  @ApiProperty({ required: false, enum: PersonnelStatus }) @IsOptional() status?: PersonnelStatus;
  @ApiProperty({ required: false }) @IsOptional() search?: string;
  @ApiProperty({ required: false }) @IsOptional() page?: string;
  @ApiProperty({ required: false }) @IsOptional() limit?: string;
}

// Kullanıcının kendi profilinde değiştirebileceği güvenli alanlar
export class UpdateMyProfileDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() emergencyContact?: string;
}
