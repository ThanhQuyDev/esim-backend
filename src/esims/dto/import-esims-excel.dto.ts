import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ImportEsimsExcelDto {
  @ApiProperty({ type: String, example: 'esimvn' })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiProperty({ type: String, example: 'VN' })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Sheet name or 0-based index',
  })
  @IsOptional()
  @IsString()
  sheet?: string;
}
