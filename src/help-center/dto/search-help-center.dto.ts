import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchHelpCenterDto {
  @ApiProperty({
    type: String,
    description: 'Keyword to search in title or content',
  })
  @IsString()
  @IsNotEmpty()
  q: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by language (e.g. "en", "vi")',
  })
  @IsOptional()
  @IsString()
  language?: string;
}
