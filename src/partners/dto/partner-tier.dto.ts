import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartnerTypeEnum } from '../partners.enum';

export class CreatePartnerTierDto {
  @ApiProperty({ enum: PartnerTypeEnum })
  @IsEnum(PartnerTypeEnum)
  partnerType!: PartnerTypeEnum;

  @ApiProperty({ example: 'SILVER' })
  @IsString()
  tierCode!: string;

  @ApiProperty({ example: 'Bạc' })
  @IsString()
  tierName!: string;

  @ApiPropertyOptional({ type: Number, example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minVolumeVnd?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 5,
    description: 'KOL commission % on order value',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 15,
    description: 'Distribution partner max resale discount % vs list price',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountPercent?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 15,
    description:
      'Days a click keeps earning the order for this tier; each new click restarts it (#037)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionDays?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 100000000,
    description:
      'Ký quỹ tối thiểu cũng đạt hạng này — thay thế cho doanh thu, không phải điều kiện thứ hai (#073). 0 = chỉ xét doanh thu.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDepositVnd?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    description:
      '% cộng vào giá gốc cho đối tác phân phối (#073): 10 nghĩa là eSIM giá vốn 100.000đ được mua với 110.000đ.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costMarkupPercent?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Hạng nội bộ: không hiện trong bảng xếp hạng công khai, không được xét thăng hạng tự động (#074).',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional({ type: Number, example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePartnerTierDto {
  @ApiPropertyOptional({
    type: Number,
    example: 100000000,
    description:
      'Ký quỹ tối thiểu cũng đạt hạng này — thay thế cho doanh thu, không phải điều kiện thứ hai (#073). 0 = chỉ xét doanh thu.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDepositVnd?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    description:
      '% cộng vào giá gốc cho đối tác phân phối (#073): 10 nghĩa là eSIM giá vốn 100.000đ được mua với 110.000đ.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costMarkupPercent?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Hạng nội bộ: không hiện trong bảng xếp hạng công khai, không được xét thăng hạng tự động (#074).',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tierName?: string;

  /** Days a click keeps earning the order for this tier (#037). */
  @ApiPropertyOptional({ type: Number, example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionDays?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minVolumeVnd?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountPercent?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
