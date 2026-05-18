import {
  // decorators here

  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateFaqDto {
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  url?: string | null;

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
    required: true,
    type: () => String,
  })
  @IsString()
  answer: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  question: string;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
