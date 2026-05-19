import {
  // decorators here

  IsString,
  IsOptional,
  IsIn,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateTopBarDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  url: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  buttonContent: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  title: string;

  @ApiProperty({
    required: true,
    type: () => String,
    example: 'en',
    description: 'Language code: en or vi',
  })
  @IsString()
  @IsIn(['en', 'vi'])
  language: string;

  @ApiProperty({
    required: false,
    type: () => String,
    description: 'Icon URL',
  })
  @IsOptional()
  @IsString()
  icon?: string | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
