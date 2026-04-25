import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { HelpCenterCategory, HelpCenterParent } from '../domain/help-center';

export class FindAllHelpCenterDto {
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

  @ApiPropertyOptional({ enum: HelpCenterCategory })
  @IsOptional()
  @IsEnum(HelpCenterCategory)
  category?: HelpCenterCategory;

  @ApiPropertyOptional({ enum: HelpCenterParent })
  @IsOptional()
  @IsEnum(HelpCenterParent)
  parent?: HelpCenterParent;
}
