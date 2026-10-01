import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { MENU_SLIDE_KEYS } from '../menu-slide-keys';

export class FindAllMenuSlidesDto {
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
    enum: MENU_SLIDE_KEYS,
    description: 'Only slides of this mega-menu panel',
  })
  @IsOptional()
  @IsString()
  @IsIn(MENU_SLIDE_KEYS as unknown as string[])
  menuKey?: string;
}
