import {
  // decorators here

  IsString,
  IsOptional,
  IsBoolean,
  IsDate,
  IsArray,
  IsNumber,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  // decorators here

  Transform,
} from 'class-transformer';

export class CreateBlogDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  language: string;

  @ApiProperty({
    required: false,
    type: () => Date,
  })
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  publishedAt?: Date | null;

  @ApiProperty({
    required: false,
    type: () => Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  author?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  authorAvatar?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  parent?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  content: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  slug: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  title: string;

  @ApiProperty({
    required: false,
    type: () => Number,
  })
  @IsOptional()
  @IsNumber()
  timeRead?: number | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  miniTagId?: string | null;

  /**
   * @deprecated Use {@link planCodes}. Numeric plan ids do not survive a
   * catalogue re-import (#047); kept so existing callers keep working.
   */
  @ApiProperty({
    required: false,
    type: () => [Number],
  })
  @IsOptional()
  @IsArray()
  planIds?: number[];

  /**
   * Related plans, by a provider-sourced reference: the plan slug or the
   * supplier's own package code (#047). Takes precedence over {@link planIds},
   * and is what survives a full catalogue re-import.
   */
  @ApiPropertyOptional({
    type: () => [String],
    example: ['ID_1_7', 'jp-5gb-30days-fixed'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  planCodes?: string[];

  @ApiProperty({
    required: false,
    type: () => [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  faqIds?: string[];

  @ApiProperty({
    required: false,
    type: () => Boolean,
  })
  @IsOptional()
  @IsBoolean()
  faqEnabled?: boolean;

  @ApiProperty({
    required: false,
    type: () => Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
