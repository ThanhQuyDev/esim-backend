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
    description: 'Search by contact name/email/company name',
  })
  @IsOptional()
  @IsString()
  search?: string;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
