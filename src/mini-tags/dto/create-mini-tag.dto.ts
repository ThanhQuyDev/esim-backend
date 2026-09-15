import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMiniTagDto {
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  image?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  title: string;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  contentButton?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  linkUrl?: string | null;

  // English copy (#059); empty keeps the Vietnamese one on English posts.
  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  titleEn?: string | null;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  contentButtonEn?: string | null;

  @ApiProperty({ required: false, type: () => String })
  @IsOptional()
  @IsString()
  linkUrlEn?: string | null;
}
