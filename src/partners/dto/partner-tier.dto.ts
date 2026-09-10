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
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tierName?: string;

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
