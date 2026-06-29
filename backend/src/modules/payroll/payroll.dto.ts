import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetSalaryDto {
  @ApiProperty()
  @IsNumber() grossSalary!: number;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() agi?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() mealAllowance?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() transportAllowance?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() bes?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class GeneratePayrollDto {
  @ApiProperty() @IsString() personnelId!: string;
  @ApiProperty() @IsNumber() year!: number;
  @ApiProperty() @IsNumber() @Min(1) @Max(12) month!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() bonus?: number;
}

export class CreateExpenseDto {
  @ApiProperty() @IsString() category!: string;
  @ApiProperty() @IsNumber() amount!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsDateString() date!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() receiptUrl?: string;
}

export class ApproveExpenseDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() rejectionReason?: string;
}
