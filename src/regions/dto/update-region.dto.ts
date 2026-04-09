import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRegionDto } from './create-region.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRegionDto extends PartialType(CreateRegionDto) {
  @ApiPropertyOptional({ example: 'Asia', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'asia', type: String })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
