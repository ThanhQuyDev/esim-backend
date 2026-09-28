import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PartnerStatusEnum, PartnerTypeEnum } from '../partners.enum';

export class QueryPartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  limit?: number;

  @ApiPropertyOptional({ enum: PartnerTypeEnum })
  @IsOptional()
  @IsEnum(PartnerTypeEnum)
  partnerType?: PartnerTypeEnum;

  @ApiPropertyOptional({ enum: PartnerStatusEnum })
  @IsOptional()
  @IsEnum(PartnerStatusEnum)
  status?: PartnerStatusEnum;

  @ApiPropertyOptional({
    description:
      'Search by contact name, email, company name, phone or partner id (#058).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tier code (#058).' })
  @IsOptional()
  @IsString()
  tierCode?: string;
}

export class QueryPartnerCommissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  limit?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  partnerId?: number;

  /**
   * `all`, `pending` (chờ xác nhận), `reviewing` (đang kiểm tra) or `credited`
   * (đã duyệt) — see `adminListCommissions` for what "đang kiểm tra" means
   * (#064).
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Partner name, email, phone or id (#064).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /** Reconciliation period, as `YYYY-MM` (#064). */
  @ApiPropertyOptional({ example: '2026-09' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  to?: string;
}
