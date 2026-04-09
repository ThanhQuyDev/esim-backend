import {
  // decorators here

  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateWhyChooseUsDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  language: string;

  @ApiProperty({
    required: false,
    type: () => Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  @IsNumber()
  sortOrder: number;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  description: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  title: string;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
