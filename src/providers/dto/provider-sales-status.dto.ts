import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
