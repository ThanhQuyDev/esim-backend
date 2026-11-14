import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetProviderSalesStatusDto {
  @ApiProperty({
    example: false,
    description:
      'false switches the supplier off and deactivates every plan it supplies',
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiPropertyOptional({ example: 'API nhà cung cấp lỗi, tạm ngưng bán' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  disabledReason?: string | null;
}

export class ProviderSalesStatusDto {
  @ApiProperty({ example: 'billion' })
  provider: string;

  @ApiProperty({ example: true })
  isEnabled: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  disabledReason: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  disabledAt: string | null;

  /** Plans on sale right now. 0 while the supplier is switched off. */
  @ApiProperty({ example: 1004 })
  activePlanCount: number;

  /**
   * Plans this switch deactivated, i.e. what comes back on if it is switched on
   * again. 0 while the supplier is selling.
   */
  @ApiProperty({ example: 0 })
  disabledPlanCount: number;

  /** "Billion Connect" (vande-1411 #024). */
  @ApiPropertyOptional({ type: String, nullable: true })
  displayName: string | null;

  /** "BL", shown on the overview instead of the name. */
  @ApiPropertyOptional({ type: String, nullable: true })
  shortCode: string | null;

  /** Sold through an API this backend talks to; cannot be deleted. */
  @ApiProperty({ example: true })
  isApi: boolean;

  /** Added by hand in the CMS (a domestic supplier imported by file). */
  @ApiProperty({ example: false })
  isManual: boolean;

  /** Every plan it supplies, on sale or not. */
  @ApiProperty({ example: 1004 })
  planCount: number;

  /** Its eSIMs, in stock or sold. */
  @ApiProperty({ example: 0 })
  esimCount: number;
}

/**
 * "+ Thêm nhà cung cấp" (vande-1411 #024). Only for a domestic supplier whose
 * eSIMs are imported by file: the system name becomes "<carrier>-noidia", the
 * provider a domestic import file gives its plans.
 */
export class CreateProviderDto {
  @ApiProperty({ example: 'Vietnamobile' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName: string;

  @ApiProperty({
    example: 'vietnamobile',
    description: 'Carrier slug; stored as "<slug>-noidia"',
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{0,56}$/, {
    message: 'Tên hệ thống chỉ gồm chữ thường không dấu, số, "-" hoặc "_"',
  })
  provider: string;

  @ApiProperty({ example: 'VNM-ND' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  shortCode: string;
}

export class UpdateProviderDto {
  @ApiPropertyOptional({ example: 'Billion Connect' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: 'BL' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  shortCode?: string;
}
