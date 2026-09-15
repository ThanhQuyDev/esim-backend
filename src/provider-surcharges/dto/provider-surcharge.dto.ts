import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertProviderSurchargeDto {
  @ApiProperty({
    example: 10,
    description:
      'Percent added to the supplier cost before prices are compared',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage: number;

  @ApiPropertyOptional({ example: 'VAT 10% trên hoá đơn nhà cung cấp' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ProviderSurchargeDto {
  @ApiProperty({ example: 'billion' })
  provider: string;

  @ApiProperty({ example: 10 })
  percentage: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  note: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  updatedAt: string | null;

  /** How many active plans the surcharge affects. */
  @ApiProperty({ example: 1004 })
  activePlanCount: number;
}
