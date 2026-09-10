import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProviderDepositEntryType } from '../infrastructure/persistence/relational/entities/provider-deposit-entry.entity';

export class CreateProviderDepositEntryDto {
  @ApiProperty({ example: 'esimaccess' })
  @IsString()
  @MaxLength(64)
  provider: string;

  @ApiPropertyOptional({
    enum: ProviderDepositEntryType,
    default: ProviderDepositEntryType.Deposit,
  })
  @IsOptional()
  @IsEnum(ProviderDepositEntryType)
  type?: ProviderDepositEntryType;

  @ApiPropertyOptional({
    example: 50000000,
    description:
      'Movement in VND. Positive tops the deposit up, negative takes away.',
  })
  @IsOptional()
  @IsNumber()
  amountVnd?: number;

  @ApiPropertyOptional({
    example: 42000000,
    description: "Balance the supplier's own dashboard showed, in VND.",
  })
  @IsOptional()
  @IsNumber()
  reportedBalanceVnd?: number | null;

  @ApiPropertyOptional({ example: 'Chuyển khoản Techcombank 12/09' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({ example: '2026-09-09T03:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class UpdateProviderDepositEntryDto {
  @ApiPropertyOptional({ enum: ProviderDepositEntryType })
  @IsOptional()
  @IsEnum(ProviderDepositEntryType)
  type?: ProviderDepositEntryType;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @IsNumber()
  amountVnd?: number;

  @ApiPropertyOptional({ example: 42000000 })
  @IsOptional()
  @IsNumber()
  reportedBalanceVnd?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class QueryProviderDepositEntryDto {
  @ApiPropertyOptional({ example: 'esimaccess' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

/** One row of the "danh sách đối tác" table in the CMS. */
export class ProviderDepositSummaryDto {
  @ApiProperty({ example: 'esimaccess' })
  provider: string;

  @ApiProperty({ example: 100000000, description: 'Total paid in, VND.' })
  totalDepositedVnd: number;

  @ApiProperty({
    example: 58000000,
    description: 'Cost of every completed order item from this supplier, VND.',
  })
  totalSpentVnd: number;

  @ApiProperty({
    example: 42000000,
    description: 'totalDepositedVnd - totalSpentVnd.',
  })
  expectedBalanceVnd: number;

  @ApiProperty({
    example: 41500000,
    nullable: true,
    description: 'Latest balance the supplier reported, VND (null if never).',
  })
  reportedBalanceVnd: number | null;

  @ApiProperty({ example: '2026-09-09T03:00:00.000Z', nullable: true })
  reportedAt: string | null;

  @ApiProperty({
    example: -500000,
    nullable: true,
    description:
      'reportedBalanceVnd - expectedBalanceVnd. Non-zero means the books drifted.',
  })
  differenceVnd: number | null;

  @ApiProperty({ example: 3 })
  entryCount: number;
}
