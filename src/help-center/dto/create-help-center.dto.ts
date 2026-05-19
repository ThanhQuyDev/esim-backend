import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateHelpCenterDto {
  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  title: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  content: string;

  @ApiProperty({ required: false, type: () => Number, default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  category: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  parent: string;

  @ApiProperty({ required: false, type: () => Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiProperty({ required: false, type: () => Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
