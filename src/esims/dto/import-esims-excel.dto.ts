import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ImportEsimsExcelDto {
  @ApiPropertyOptional({
    type: String,
    example: 'esimvn',
    description:
      'Provider name. If omitted, read from "Carrier" column in Excel.',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'VN',
    description:
      'Country code. If omitted, read from "Country Code" column in Excel.',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Sheet name or 0-based index',
  })
  @IsOptional()
  @IsString()
  sheet?: string;
}
