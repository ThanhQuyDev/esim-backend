import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ImportEsimsExcelDto {
  @ApiPropertyOptional({
    type: String,
    example: 'Wintel',
    description:
      'Local carrier for every row, e.g. "Viettel", "Wintel". Takes precedence over the "Carrier" column, which is only used when this is omitted.',
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
